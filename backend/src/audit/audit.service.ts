import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async record(params: {
    actor: AuthUser | { userId: string };
    action: AuditAction;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actor.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          before: params.before as any,
          after: params.after as any,
          ip: params.ip,
        },
      });
    } catch {
      // El audit log nunca debe romper la operación principal
    }
  }
}
