
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
    udhariGivenDetails: z.array(z.object({
        customerName: z.string(),
        amount: z.number(),
        balance: z.number(),
    })),
    udhariPaidDetails: z.array(z.object({
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


const sendSmsTool = ai.defineTool(
    {
        name: 'sendSmsTool',
        description: 'Sends an SMS message using Twilio',
        inputSchema: z.object({
            to: z.string(),
            body: z.string(),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            messageId: z.string().optional(),
            error: z.string().optional(),
        }),
    },
    async ({ to, body }) => {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

        if (!accountSid || !authToken || !messagingServiceSid) {
            return {
                success: false,
                error: 'Twilio environment variables (accountSid, authToken, messagingServiceSid) are not fully configured.',
            };
        }

        const client = new Twilio(accountSid, authToken);

        try {
            const message = await client.messages.create({
                body: body.trim(),
                messagingServiceSid: messagingServiceSid,
                to: to,
            });

            return { success: true, messageId: message.sid };
        } catch (error: any) {
            console.error('Twilio Error:', error);
            return {
                success: false,
                error: error.message || 'Failed to send SMS via tool.',
            };
        }
    }
);


export async function sendSmsReport(data: SmsReportData): Promise<z.infer<typeof SmsFlowOutputSchema>> {
    return smsReportFlow(data);
}

const smsReportFlow = ai.defineFlow(
    {
        name: 'smsReportFlow',
        inputSchema: SmsReportDataSchema,
        outputSchema: SmsFlowOutputSchema,
        tools: [sendSmsTool],
    },
    async (data) => {
        const toNumber = process.env.ADMIN_PHONE_NUMBER;

        if (!toNumber) {
            return {
                success: false,
                error: 'Admin phone number is not configured. Please set ADMIN_PHONE_NUMBER in your environment variables.',
            };
        }

        // Construct the message body
        let body = `MOB Daily Report: ${data.date}\n\n`;

        Object.entries(data.summaries).forEach(([key, value]) => {
            if (value !== 0) {
                const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                body += `${formattedKey}: ${Math.abs(value).toFixed(2)}\n`;
            }
        });

        if (data.udhariGivenDetails.length > 0) {
            body += '\nUdhari Given:\n';
            data.udhariGivenDetails.forEach(udhari => {
                const oldBalance = udhari.balance - udhari.amount;
                body += `- ${udhari.customerName} (${udhari.amount.toFixed(2)}). Bal: ${oldBalance.toFixed(2)} -> ${udhari.balance.toFixed(2)}\n`;
            });
        }
        
        if (data.udhariPaidDetails.length > 0) {
            body += '\nUdhari Paid:\n';
            data.udhariPaidDetails.forEach(udhari => {
                const oldBalance = udhari.balance + udhari.amount;
                body += `- ${udhari.customerName} (${udhari.amount.toFixed(2)}). Bal: ${oldBalance.toFixed(2)} -> ${udhari.balance.toFixed(2)}\n`;
            });
        }
        
        if (data.staffDetails.length > 0) {
            body += '\nStaff Status:\n';
            data.staffDetails.forEach(staff => {
                body += `- ${staff.name}: ${staff.status}\n`;
            });
        }

        return await sendSmsTool({ to: toNumber, body });
    }
);
