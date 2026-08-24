import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBeneficiaryDto, CreateBeneficiaryAccountDto } from './dto/beneficiary.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/current-user.decorator';
import { AuditAction, Role } from '@prisma/client';

@Injectable()
export class BeneficiariesService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async assertCustomerOwned(customerId: string, actor: AuthUser) {
    if (actor.role !== Role.CUSTOMER) return;
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.userId !== actor.userId) {
      throw new ForbiddenException('Solo puede operar con sus propios beneficiarios');
    }
  }

  private async assertBeneficiaryOwned(beneficiaryId: string, actor: AuthUser) {
    if (actor.role !== Role.CUSTOMER) return;
    const ben = await this.prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
    if (!ben) throw new NotFoundException('Beneficiario no encontrado');
    await this.assertCustomerOwned(ben.customerId, actor);
  }

  async create(dto: CreateBeneficiaryDto, actor: AuthUser) {
    await this.assertCustomerOwned(dto.customerId, actor);
    const beneficiary = await this.prisma.beneficiary.create({ data: dto });
    await this.audit.record({
      actor,
      action: AuditAction.CREATE,
      entity: 'Beneficiary',
      entityId: beneficiary.id,
      after: { fullName: beneficiary.fullName, document: beneficiary.documentNumber },
    });
    return beneficiary;
  }

  async addAccount(beneficiaryId: string, dto: CreateBeneficiaryAccountDto, actor: AuthUser) {
    const ben = await this.prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
    if (!ben) throw new NotFoundException('Beneficiario no encontrado');
    await this.assertCustomerOwned(ben.customerId, actor);
    const account = await this.prisma.beneficiaryAccount.create({
      data: { beneficiaryId, ...dto },
    });
    await this.audit.record({
      actor,
      action: AuditAction.CREATE,
      entity: 'BeneficiaryAccount',
      entityId: account.id,
      after: { bankName: account.bankName },
    });
    return account;
  }

  async listByCustomer(customerId: string, actor?: AuthUser) {
    if (actor?.role === Role.CUSTOMER) {
      await this.assertCustomerOwned(customerId, actor);
    }
    return this.prisma.beneficiary.findMany({
      where: { customerId },
      include: { accounts: true, country: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(query: { search?: string }) {
    const where: any = {};
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { documentNumber: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }
    return this.prisma.beneficiary.findMany({
      where,
      include: { accounts: true, country: true, customer: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async update(id: string, dto: any, actor: AuthUser) {
    const ben = await this.prisma.beneficiary.findUnique({ where: { id } });
    if (!ben) throw new NotFoundException('Beneficiario no encontrado');
    await this.assertCustomerOwned(ben.customerId, actor);
    const updated = await this.prisma.beneficiary.update({
      where: { id },
      data: dto,
    });
    await this.audit.record({
      actor,
      action: AuditAction.UPDATE,
      entity: 'Beneficiary',
      entityId: id,
      before: { fullName: ben.fullName, phone: ben.phone },
      after: { fullName: updated.fullName, phone: updated.phone },
    });
    return updated;
  }

  async delete(id: string, actor: AuthUser) {
    const ben = await this.prisma.beneficiary.findUnique({ where: { id } });
    if (!ben) throw new NotFoundException('Beneficiario no encontrado');
    await this.assertCustomerOwned(ben.customerId, actor);
    await this.prisma.beneficiary.delete({ where: { id } });
    await this.audit.record({
      actor,
      action: AuditAction.DELETE,
      entity: 'Beneficiary',
      entityId: id,
      before: { fullName: ben.fullName, documentNumber: ben.documentNumber },
    });
    return { success: true, message: 'Beneficiario eliminado correctamente' };
  }
}
