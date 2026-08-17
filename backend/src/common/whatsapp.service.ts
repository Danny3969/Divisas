import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  generatePickupMessage(params: {
    beneficiaryName: string;
    senderName: string;
    receiveAmount: number | string;
    receiveCurrency: string;
    withdrawalCode: string;
    beneficiaryPhone?: string;
  }) {
    const text = `*DIVISAS REMESAS INTERNACIONALES*\n\nHola *${params.beneficiaryName}*,\n\n*${params.senderName}* te ha enviado un giro por *${params.receiveAmount} ${params.receiveCurrency}*.\n\nPuedes retirarlo en cualquier oficina de Divisas en Perú presentando tu DNI y el siguiente código:\n\n🔑 *Código de Retiro:* ${params.withdrawalCode}\n\nVigencia: 30 días. ¡Gracias por confiar en Divisas!`;
    const encoded = encodeURIComponent(text);
    const phoneClean = params.beneficiaryPhone ? params.beneficiaryPhone.replace(/\D/g, '') : '';
    const link = phoneClean ? `https://wa.me/${phoneClean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    return { text, link };
  }
}
