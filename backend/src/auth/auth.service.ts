import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { AuthUser } from '../common/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('El email ya está registrado');
    }
    if (dto.role === Role.CUSTOMER && dto.customer) {
      const dup = await this.prisma.customer.findUnique({
        where: {
          documentType_documentNumber: {
            documentType: dto.customer.documentType,
            documentNumber: dto.customer.documentNumber,
          },
        },
      });
      if (dup) {
        throw new ConflictException('El documento ya está registrado');
      }
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          role: dto.role,
          officeId: dto.officeId || null,
        },
      });
      if (dto.role === Role.CUSTOMER && dto.customer) {
        await tx.customer.create({
          data: {
            userId: created.id,
            type: dto.customer.type,
            fullName: dto.fullName,
            documentType: dto.customer.documentType,
            documentNumber: dto.customer.documentNumber,
            countryId: dto.customer.countryId,
            email: dto.email,
            phone: dto.phone,
            kycStatus: 'APPROVED',
          },
        });
      }
      return created;
    });
    await this.audit.record({
      actor: { userId: user.id },
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: user.id,
      after: { email: user.email, role: user.role },
    });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        office: {
          include: { country: true },
        },
      },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      actor: { userId: user.id },
      action: AuditAction.LOGIN,
      entity: 'User',
      entityId: user.id,
      ip,
    });
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    officeId: string | null;
    office?: { id: string; name: string; country?: { code: string; name: string } | null } | null;
  }) {
    const payload: AuthUser = {
      userId: user.id,
      email: user.email,
      role: user.role,
      officeId: user.officeId,
    };
    return {
      accessToken: this.jwt.sign(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN') || '30d',
      }),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        officeId: user.officeId,
        officeName: user.office?.name ?? null,
        office: user.office
          ? {
              id: user.office.id,
              name: user.office.name,
              country: user.office.country
                ? { code: user.office.country.code, name: user.office.country.name }
                : null,
            }
          : null,
      },
    };
  }
}
