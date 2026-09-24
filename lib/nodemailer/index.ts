import nodemailer from 'nodemailer';
import { WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE, STOCK_ALERT_UPPER_EMAIL_TEMPLATE, STOCK_ALERT_LOWER_EMAIL_TEMPLATE } from "@/lib/nodemailer/templates";

type EmailSendResult =
    | { status: 'skipped' }
    | { status: 'sent'; messageId: string };

const hasEmailConfig = Boolean(process.env.NODEMAILER_EMAIL && process.env.NODEMAILER_PASSWORD);

if (!hasEmailConfig) {
    console.warn('⚠️ Email credentials are not configured. Welcome and news summary emails are disabled until NODEMAILER_EMAIL and NODEMAILER_PASSWORD are set.');
}

export const transporter = hasEmailConfig
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.NODEMAILER_EMAIL!,
            pass: process.env.NODEMAILER_PASSWORD!,
        },
        // Keep the pool small because email volume is low in this app.
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
    })
    : null;

if (transporter) {
    transporter.verify((error) => {
        if (error) {
            console.error('❌ Nodemailer transporter verification failed:', error);
        } else {
            console.log('✅ Nodemailer transporter is ready to send emails');
        }
    });
}

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    try {
        if (!transporter) {
            console.warn('⚠️ Welcome email skipped: email credentials are not configured.');
            return { status: 'skipped' } satisfies EmailSendResult;
        }

        const htmlTemplate = WELCOME_EMAIL_TEMPLATE
            .replace('{{name}}', name)
            .replace('{{intro}}', intro);

        const mailOptions = {
            from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `Welcome to Openstock - your open-source stock market toolkit!`,
            text: 'Thanks for joining Openstock, an initiative by open dev society',
            html: htmlTemplate,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Welcome email sent successfully:', info.messageId);
        return { status: 'sent', messageId: info.messageId } satisfies EmailSendResult;
    } catch (error) {
        console.error('❌ Failed to send welcome email:', error);
        throw error;
    }
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
) => {
    try {
        if (!transporter) {
            console.warn('⚠️ News summary email skipped: email credentials are not configured.');
            return { status: 'skipped' } satisfies EmailSendResult;
        }

        const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
            .replace('{{date}}', date)
            .replace('{{newsContent}}', newsContent);

        const mailOptions = {
            from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `📈 Market News Summary Today - ${date}`,
            text: `Today's market news summary from Openstock`,
            html: htmlTemplate,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ News summary email sent successfully:', info.messageId);
        return { status: 'sent', messageId: info.messageId } satisfies EmailSendResult;
    } catch (error) {
        console.error('❌ Failed to send news summary email:', error);
        throw error;
    }
};

const fillTemplate = (template: string, values: Record<string, string>) =>
    Object.entries(values).reduce((html, [key, value]) => html.split(`{{${key}}}`).join(value), template);

export const sendPriceAlertEmail = async ({
    email,
    symbol,
    company,
    condition,
    currentPrice,
    targetPrice,
}: {
    email: string;
    symbol: string;
    company?: string;
    condition: 'ABOVE' | 'BELOW';
    currentPrice: number;
    targetPrice: number;
}) => {
    if (!transporter) {
        console.warn('⚠️ Price alert email skipped: email credentials are not configured.');
        return { status: 'skipped' } satisfies EmailSendResult;
    }

    const usd = (n: number) => `$${n.toFixed(2)}`;
    const template = condition === 'ABOVE' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;
    const html = fillTemplate(template, {
        symbol,
        company: company || symbol,
        currentPrice: usd(currentPrice),
        targetPrice: usd(targetPrice),
        timestamp: new Date().toUTCString(),
    });
    const direction = condition === 'ABOVE' ? 'above' : 'below';

    const info = await transporter.sendMail({
        from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: `Price alert: ${symbol} is ${direction} ${usd(targetPrice)} (now ${usd(currentPrice)})`,
        text: `${symbol} is now ${usd(currentPrice)}, ${direction} your target of ${usd(targetPrice)}.`,
        html,
    });
    console.log(`✅ Price alert email sent for ${symbol}:`, info.messageId);
    return { status: 'sent', messageId: info.messageId } satisfies EmailSendResult;
};
