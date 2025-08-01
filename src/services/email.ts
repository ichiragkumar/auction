import nodemailer from 'nodemailer';
import { logger } from '../config/logger';

export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendAuctionInvitation(emails: string[], auctionDetails: any) {
    try {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: emails,
        subject: `🔨 Join Auction: ${auctionDetails.productName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You're Invited to Bid!</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${auctionDetails.productName}</h3>
              <p><strong>Reserve Price:</strong> $${auctionDetails.reservePrice}</p>
              <p><strong>Auction Starts:</strong> ${new Date(auctionDetails.startTime).toLocaleString()}</p>
              <p><strong>Auction Ends:</strong> ${new Date(auctionDetails.endTime).toLocaleString()}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/auction/${auctionDetails._id}" 
                 style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Join Auction
              </a>
            </div>
            <p style="color: #666; font-size: 12px;">
              This auction supports up to 10,000 participants. Bid wisely!
            </p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Auction invitation sent to ${emails.length} users`);
    } catch (error) {
      logger.error('Error sending auction invitation:', error);
    }
  }

  async sendAuctionEndNotification(userEmail: string, auctionDetails: any, isWinner: boolean) {
    try {
      const subject = isWinner ? 
        `🎉 Congratulations! You won: ${auctionDetails.productName}` :
        `📋 Auction Ended: ${auctionDetails.productName}`;

      const content = isWinner ? `
        <h2>Congratulations! 🎉</h2>
        <p>You have won the auction for <strong>${auctionDetails.productName}</strong></p>
        <p><strong>Your winning bid:</strong> $${auctionDetails.winningBid}</p>
        <p>We will contact you shortly with payment and delivery details.</p>
      ` : `
        <h2>Auction Ended</h2>
        <p>The auction for <strong>${auctionDetails.productName}</strong> has ended.</p>
        <p><strong>Winning bid:</strong> $${auctionDetails.winningBid}</p>
        <p>Thank you for participating!</p>
      `;

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: userEmail,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${content}
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${auctionDetails.productName}</h3>
              <p><strong>Final Price:</strong> $${auctionDetails.winningBid}</p>
              <p><strong>Auction ID:</strong> ${auctionDetails._id}</p>
            </div>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      logger.error('Error sending auction end notification:', error);
    }
  }

  async sendMerchantNotification(merchantEmail: string, auctionDetails: any) {
    try {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: merchantEmail,
        subject: `💰 Auction Completed: ${auctionDetails.productName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your Auction Has Ended Successfully! 💰</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>${auctionDetails.productName}</h3>
              <p><strong>Final Sale Price:</strong> $${auctionDetails.winningBid}</p>
              <p><strong>Reserve Price:</strong> $${auctionDetails.reservePrice}</p>
              <p><strong>Winner:</strong> ${auctionDetails.winner?.name}</p>
              <p><strong>Winner Email:</strong> ${auctionDetails.winner?.email}</p>
              <p><strong>Total Participants:</strong> ${auctionDetails.totalParticipants}</p>
            </div>
            <p>Please proceed with the transaction details and delivery arrangements.</p>
          </div>
        `
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      logger.error('Error sending merchant notification:', error);
    }
  }
  async sendJoinConfirmation(userEmail: string, auctionDetails: any) {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: userEmail,
      subject: `✅ Joined Auction: ${auctionDetails.productName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You've successfully joined the auction!</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>${auctionDetails.productName}</h3>
            <p><strong>Reserve Price:</strong> $${auctionDetails.reservePrice}</p>
            <p><strong>Auction Ends:</strong> ${new Date(auctionDetails.endTime).toLocaleString()}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/auction/${auctionDetails._id}" 
               style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Place Your Bid Now
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            This is your confirmation of joining the auction. Don’t miss out — place your bids before time runs out!
          </p>
        </div>
      `
    };

    await this.transporter.sendMail(mailOptions);
    logger.info(`Join confirmation sent to ${userEmail} for auction ${auctionDetails._id}`);
  } catch (error) {
    logger.error('Error sending join confirmation:', error);
  }
}

}

export const emailService = new EmailService();