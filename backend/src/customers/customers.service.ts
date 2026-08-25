import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, ApproveKycDto, UpdateCustomerDto } from './dto/customer.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import { AuditAction, Role } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(dto: CreateCustomerDto, actor: AuthUser) {
    const dup = await this.prisma.customer.findUnique({
      where: { documentType_documentNumber: { documentType: dto.documentType, documentNumber: dto.documentNumber } },
    });
    if (dup) {
      throw new BadRequestException('Ya existe un cliente con ese documento');
    }
    const customer = await this.prisma.customer.create({
      data: {
        ...dto,
        kycStatus: 'APPROVED',
      },
    });
    await this.audit.record({
      actor,
      action: AuditAction.CREATE,
      entity: 'Customer',
      entityId: customer.id,
      after: { fullName: customer.fullName, document: customer.documentNumber },
    });
    return customer;
  }

  async findByDocument(documentType: string, documentNumber: string) {
    return this.prisma.customer.findUnique({
      where: { documentType_documentNumber: { documentType: documentType as any, documentNumber } },
      include: { country: true },
    });
  }

  async findByUser(userId: string) {
    let customer = await this.prisma.customer.findUnique({
      where: { userId },
      include: { country: true },
    });
    if (!customer) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const country = (await this.prisma.country.findFirst({ where: { code: 'EC' } })) ?? (await this.prisma.country.findFirst());
        if (country) {
          const docNum = user.phone ? user.phone.replace(/\D/g, '') : `09${Math.floor(10000000 + Math.random() * 90000000)}`;
          customer = await this.prisma.customer.upsert({
            where: {
              documentType_documentNumber: {
                documentType: 'CEDULA',
                documentNumber: docNum,
              },
            },
            update: { userId: user.id },
            create: {
              userId: user.id,
              type: 'PERSON',
              fullName: user.fullName,
              documentType: 'CEDULA',
              documentNumber: docNum,
              countryId: country.id,
              email: user.email,
              phone: user.phone || '+593991234567',
              kycStatus: 'APPROVED',
            },
            include: { country: true },
          });
        }
      }
    }
    if (!customer) throw new NotFoundException('Perfil de cliente no encontrado');
    return customer;
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        country: true,
        beneficiaries: { include: { accounts: true } },
        transfers: { take: 20, orderBy: { createdAt: 'desc' } },
        documents: true,
      },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async list(query: { search?: string; kycStatus?: string; page?: number; limit?: number }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const where: any = {};
    if (query.kycStatus) where.kycStatus = query.kycStatus;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { documentNumber: { contains: query.search } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: { country: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async update(id: string, dto: UpdateCustomerDto, actor: AuthUser) {
    const customer = await this.findOne(id);
    const updated = await this.prisma.customer.update({
      where: { id },
      data: dto,
    });
    await this.audit.record({
      actor,
      action: AuditAction.UPDATE,
      entity: 'Customer',
      entityId: id,
      before: { fullName: customer.fullName, phone: customer.phone },
      after: { fullName: updated.fullName, phone: updated.phone },
    });
    return updated;
  }

  async delete(id: string, actor: AuthUser) {
    const customer = await this.findOne(id);
    await this.prisma.customer.delete({ where: { id } });
    await this.audit.record({
      actor,
      action: AuditAction.DELETE,
      entity: 'Customer',
      entityId: id,
      before: { fullName: customer.fullName, documentNumber: customer.documentNumber },
    });
    return { success: true, message: 'Cliente eliminado correctamente' };
  }

  async approveKyc(id: string, dto: ApproveKycDto, actor: AuthUser) {
    if (actor.role !== Role.COMPLIANCE && actor.role !== Role.ADMIN && actor.role !== Role.SUPERVISOR) {
      throw new BadRequestException('Solo Compliance/Supervisor puede aprobar KYC');
    }
    const customer = await this.findOne(id);
    const kycStatus = dto.decision === 'REJECT' ? 'REJECTED' : 'APPROVED';
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        kycStatus,
        riskScore: dto.riskScore ?? customer.riskScore,
      },
    });
    await this.audit.record({
      actor,
      action: AuditAction.APPROVE,
      entity: 'Customer',
      entityId: id,
      before: { kycStatus: customer.kycStatus },
      after: { kycStatus },
    });
    return updated;
  }
}
