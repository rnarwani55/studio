
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Twilio } from 'twilio';

const SmsReportDataSchema = z.object({
    date: z.string(),
    summaries: z.object({
        cashSales: z.number(),
        onlineSales: z.number(),
        udhariPaid: z.number(),
        udhariGiven: z.number(),
        cashReturn: z.number(),
        expenses: z.number(),
    }),
    udhariDetails: z.array(z.object({
        customerName: z.string(),
        amount: z.number(),
        balance: z.number(),
    })),
    staffDetails: z.array(z.object({
        name: z.string(),
        status: z.string(),
    })),
});

export type SmsReportData = z.infer<typeof SmsReportDataSchema>;

const SmsFlowOutputSchema = z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    error: z.string().optional(),
});

export async function sendSmsReport(data: SmsReportData): Promise<z.infer<typeof SmsFlowOutputSchema>> {
    return smsReportFlow(data);
}

const smsReportFlow = ai.defineFlow(
    {
        name: 'smsReportFlow',
        inputSchema: SmsReportDataSchema,
        outputSchema: SmsFlowOutputSchema,
    },
    async (data) => {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        const toNumber = process.env.ADMIN_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber || !toNumber) {
            return {
                success: false,
                error: 'Twilio environment variables are not configured.',
            };
        }

        const client = new Twilio(accountSid, authToken);

        // Construct the message body
        let body = `MOB Daily Report: ${data.date}\n\n`;

        Object.entries(data.summaries).forEach(([key, value]) => {
            if (value !== 0) {
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                body += `${formattedKey}: ${Math.abs(value).toFixed(2)}\n`;
            }
        });

        if (data.udhariDetails.length > 0) {
            body += '\nUdhari Given:\n';
            data.udhariDetails.forEach(udhari => {
                body += `- ${udhari.customerName} (${udhari.amount.toFixed(2)}). New Bal: ${udhari.balance.toFixed(2)}\n`;
            });
        }
        
        if (data.staffDetails.length > 0) {
            body += '\nStaff Status:\n';
            data.staffDetails.forEach(staff => {
                body += `- ${staff.name}: ${staff.status}\n`;
            });
        }

        try {
            const message = await client.messages.create({
                body: body.trim(),
                from: fromNumber,
                to: toNumber,
            });

            return {
                success: true,
                messageId: message.sid,
            };
        } catch (error: any) {
            console.error('Twilio Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to send SMS.',
            };
        }
    }
);
