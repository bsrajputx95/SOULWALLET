import nodemailer from 'nodemailer';
import { logger } from '../logger';

export interface EmailConfig {
  provider: 'resend' | 'sendgrid' | 'smtp' | 'console';
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private config: EmailConfig;
  private transporter?: nodemailer.Transporter;

  constructor(config: EmailConfig) {
    this.config = config;
    this.initializeTransporter();
  }

  private initializeTransporter() {
    switch (this.config.provider) {
      case 'smtp':
        this.transporter = nodemailer.createTransport({
          host: this.config.smtpHost,
          port: this.config.smtpPort || 587,
          secure: this.config.smtpPort === 465,
          auth: {
            user: this.config.smtpUser,
            pass: this.config.smtpPass,
          },
        });
        break;

      case 'sendgrid':
        this.transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: this.config.apiKey,
          },
        });
        break;

      case 'resend':
        // For Resend, we'll use their API directly
        // This is a simplified implementation
        break;

      case 'console':
        // For development - just log to console
        break;
    }
  }

  /**
   * Generate password reset email template
   */
  private generatePasswordResetTemplate(resetCode: string, email: string): EmailTemplate {
    const subject = 'Password Reset Code - Soul Wallet';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Code</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-code { background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-number { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
              <p>Soul Wallet Security Team</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>We received a request to reset the password for your Soul Wallet account associated with <strong>${email}</strong>.</p>
              
                <div class="otp-code">
                <p>Your verification code is:</p>
                <div class="otp-number">${resetCode}</div>
              </div>
              
              <p>This code will expire in <strong>10 minutes</strong> for security reasons.</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul>
                  <li>Never share this code with anyone</li>
                  <li>Soul Wallet will never ask for this code via phone or email</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                </ul>
              </div>
              
              <p>If you have any questions or concerns, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>© 2024 Soul Wallet. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Password Reset Code - Soul Wallet

Hello!

We received a request to reset the password for your Soul Wallet account associated with ${email}.

Your verification code is: ${resetCode}

This code will expire in 10 minutes for security reasons.

Security Notice:
- Never share this code with anyone
- Soul Wallet will never ask for this code via phone or email
- If you didn't request this reset, please ignore this email

If you have any questions or concerns, please contact our support team.

© 2024 Soul Wallet. All rights reserved.
This is an automated message, please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Generate welcome email template
   */
  private generateWelcomeTemplate(email: string): EmailTemplate {
    const subject = 'Welcome to Soul Wallet! 🎉';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Soul Wallet</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }
            .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Soul Wallet!</h1>
              <p>Your journey into the future of digital assets begins now</p>
            </div>
            <div class="content">
              <h2>Hello ${email}!</h2>
              <p>Thank you for joining Soul Wallet! We're excited to have you as part of our community.</p>
              
              <div class="feature">
                <h3>🔐 Secure & Private</h3>
                <p>Your assets are protected with industry-leading security measures.</p>
              </div>
              
              <div class="feature">
                <h3>🚀 Fast Transactions</h3>
                <p>Experience lightning-fast transactions on the Solana blockchain.</p>
              </div>
              
              <div class="feature">
                <h3>📱 Mobile First</h3>
                <p>Manage your portfolio anywhere with our intuitive mobile app.</p>
              </div>
              
              <p>Ready to get started? Log in to your account and explore all the features Soul Wallet has to offer!</p>
              
              <a href="#" class="cta-button">Get Started</a>
              
              <p>If you have any questions, our support team is here to help.</p>
            </div>
            <div class="footer">
              <p>© 2024 Soul Wallet. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
Welcome to Soul Wallet! 🎉

Hello ${email}!

Thank you for joining Soul Wallet! We're excited to have you as part of our community.

Features you'll love:
🔐 Secure & Private - Your assets are protected with industry-leading security measures
🚀 Fast Transactions - Experience lightning-fast transactions on the Solana blockchain  
📱 Mobile First - Manage your portfolio anywhere with our intuitive mobile app

Ready to get started? Log in to your account and explore all the features Soul Wallet has to offer!

If you have any questions, our support team is here to help.

© 2024 Soul Wallet. All rights reserved.
This is an automated message, please do not reply to this email.
    `;

    return { subject, html, text };
  }

  private generateLoginNotificationTemplate(
    email: string,
    ipAddress: string,
    userAgent: string,
    timestamp: Date
  ): EmailTemplate {
    const subject = 'New Login to Your Soul Wallet Account'
    const formattedTime = timestamp.toLocaleString()
    const deviceInfo = this.parseUserAgent(userAgent)

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Login Notification</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .details { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Login Notification</h1>
              <p>Soul Wallet Security</p>
            </div>
            <div class="content">
              <p>A new login was detected on your account.</p>
              <div class="details">
                <ul>
                  <li><strong>Email:</strong> ${email}</li>
                  <li><strong>Time:</strong> ${formattedTime}</li>
                  <li><strong>IP Address:</strong> ${ipAddress}</li>
                  <li><strong>Device:</strong> ${deviceInfo.device}</li>
                  <li><strong>Browser:</strong> ${deviceInfo.browser}</li>
                  <li><strong>Operating System:</strong> ${deviceInfo.os}</li>
                </ul>
              </div>
              <p>If this wasn't you, please change your password immediately and review your recent activity.</p>
            </div>
            <div class="footer">
              <p>© 2024 Soul Wallet. All rights reserved.</p>
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const text = `
New Login to Your Soul Wallet Account

Login Details:
- Email: ${email}
- Time: ${formattedTime}
- IP Address: ${ipAddress}
- Device: ${deviceInfo.device}
- Browser: ${deviceInfo.browser}
- Operating System: ${deviceInfo.os}

If this wasn't you, please change your password immediately and review your recent activity.
    `

    return { subject, html, text }
  }

  /**
   * Generate suspicious login alert email template
   */
  private generateSuspiciousLoginTemplate(
    email: string,
    ipAddress: string,
    userAgent: string,
    location?: string,
    timestamp?: Date
  ): EmailTemplate {
    const subject = '🚨 Suspicious Login Detected - Soul Wallet Security Alert';
    const formattedTime = timestamp ? timestamp.toLocaleString() : new Date().toLocaleString();
    const deviceInfo = this.parseUserAgent(userAgent);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Suspicious Login Alert</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .alert-box { background: #fff5f5; border: 2px solid #e74c3c; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .login-details { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c; }
            .action-buttons { text-align: center; margin: 30px 0; }
            .secure-button { display: inline-block; background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px; }
            .review-button { display: inline-block; background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 Security Alert</h1>
              <p>Suspicious Login Activity Detected</p>
            </div>
            <div class="content">
              <div class="alert-box">
                <h2>⚠️ Unusual Login Detected</h2>
                <p>We detected a login to your Soul Wallet account from an unusual location or device. If this was you, you can ignore this email. If not, please take immediate action to secure your account.</p>
              </div>
              
              <div class="login-details">
                <h3>Login Details:</h3>
                <ul>
                  <li><strong>Email:</strong> ${email}</li>
                  <li><strong>Time:</strong> ${formattedTime}</li>
                  <li><strong>IP Address:</strong> ${ipAddress}</li>
                  <li><strong>Location:</strong> ${location || 'Unknown'}</li>
                  <li><strong>Device:</strong> ${deviceInfo.device}</li>
                  <li><strong>Browser:</strong> ${deviceInfo.browser}</li>
                  <li><strong>Operating System:</strong> ${deviceInfo.os}</li>
                </ul>
              </div>
              
              <div class="action-buttons">
                <a href="#" class="secure-button">Secure My Account</a>
                <a href="#" class="review-button">Review Login Activity</a>
              </div>
              
              <h3>What should you do?</h3>
              <ul>
                <li><strong>If this was you:</strong> No action needed, but consider enabling additional security measures</li>
                <li><strong>If this wasn't you:</strong> Immediately change your password and review your account activity</li>
                <li><strong>Enable additional security:</strong> Keep your password strong and consider reviewing your devices regularly</li>
                <li><strong>Review devices:</strong> Check and remove any unfamiliar devices from your account</li>
              </ul>
              
              <p><strong>Need help?</strong> Contact our security team immediately if you believe your account has been compromised.</p>
            </div>
            <div class="footer">
              <p>© 2024 Soul Wallet Security Team. All rights reserved.</p>
              <p>This is an automated security alert. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
🚨 SECURITY ALERT - Suspicious Login Detected

Hello,

We detected a login to your Soul Wallet account from an unusual location or device.

Login Details:
- Email: ${email}
- Time: ${formattedTime}
- IP Address: ${ipAddress}
- Location: ${location || 'Unknown'}
- Device: ${deviceInfo.device}
- Browser: ${deviceInfo.browser}
- Operating System: ${deviceInfo.os}

What should you do?
- If this was you: No action needed, but consider enabling additional security measures
- If this wasn't you: Immediately change your password and review your account activity
- Enable additional security: Keep your password strong and consider reviewing your devices regularly
- Review devices: Check and remove any unfamiliar devices from your account

Need help? Contact our security team immediately if you believe your account has been compromised.

© 2024 Soul Wallet Security Team. All rights reserved.
This is an automated security alert. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Generate account lockout notification email template
   */
  private generateAccountLockoutTemplate(
    email: string,
    lockoutDuration: number,
    failedAttempts: number,
    lastAttemptIp?: string
  ): EmailTemplate {
    const subject = '🔒 Account Temporarily Locked - Soul Wallet Security';
    const unlockTime = new Date(Date.now() + lockoutDuration * 60 * 1000);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Locked</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .lockout-box { background: #fff3cd; border: 2px solid #f39c12; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .security-info { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f39c12; }
            .unlock-button { display: inline-block; background: #f39c12; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Account Locked</h1>
              <p>Security Protection Activated</p>
            </div>
            <div class="content">
              <div class="lockout-box">
                <h2>Your account has been temporarily locked</h2>
                <p>Due to multiple failed login attempts, your Soul Wallet account has been temporarily locked for security reasons.</p>
              </div>
              
              <div class="security-info">
                <h3>Lockout Details:</h3>
                <ul>
                  <li><strong>Account:</strong> ${email}</li>
                  <li><strong>Failed Attempts:</strong> ${failedAttempts}</li>
                  <li><strong>Lockout Duration:</strong> ${lockoutDuration} minutes</li>
                  <li><strong>Automatic Unlock:</strong> ${unlockTime.toLocaleString()}</li>
                  ${lastAttemptIp ? `<li><strong>Last Attempt IP:</strong> ${lastAttemptIp}</li>` : ''}
                </ul>
              </div>
              
              <h3>What happens next?</h3>
              <ul>
                <li>Your account will automatically unlock in ${lockoutDuration} minutes</li>
                <li>You can also unlock your account immediately using the secure link below</li>
                <li>All active sessions have been terminated for security</li>
                <li>Consider changing your password if you suspect unauthorized access</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="#" class="unlock-button">Unlock Account Now</a>
              </div>
              
              <h3>Security Tips:</h3>
              <ul>
                <li>Use a strong, unique password for your Soul Wallet account</li>
                <li>Use a strong, unique password for your Soul Wallet account</li>
                <li>Never share your login credentials with anyone</li>
                <li>Regularly review your account activity</li>
              </ul>
              
              <p><strong>Didn't attempt to log in?</strong> If you didn't try to access your account, please contact our security team immediately.</p>
            </div>
            <div class="footer">
              <p>© 2024 Soul Wallet Security Team. All rights reserved.</p>
              <p>This is an automated security notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
🔒 ACCOUNT LOCKED - Soul Wallet Security

Your account has been temporarily locked due to multiple failed login attempts.

Lockout Details:
- Account: ${email}
- Failed Attempts: ${failedAttempts}
- Lockout Duration: ${lockoutDuration} minutes
- Automatic Unlock: ${unlockTime.toLocaleString()}
${lastAttemptIp ? `- Last Attempt IP: ${lastAttemptIp}` : ''}

What happens next?
- Your account will automatically unlock in ${lockoutDuration} minutes
- You can also unlock your account immediately using our secure process
- All active sessions have been terminated for security
- Consider changing your password if you suspect unauthorized access

Security Tips:
- Use a strong, unique password for your Soul Wallet account
- Use a strong, unique password for your Soul Wallet account
- Never share your login credentials with anyone
- Regularly review your account activity

Didn't attempt to log in? If you didn't try to access your account, please contact our security team immediately.

© 2024 Soul Wallet Security Team. All rights reserved.
This is an automated security notification. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Generate account unlocked notification email template
   */
  private generateAccountUnlockedTemplate(email: string, unlockedBy: 'auto' | 'user' | 'admin'): EmailTemplate {
    const subject = '✅ Account Unlocked - Soul Wallet';
    const unlockedByText = {
      auto: 'automatically after the lockout period expired',
      user: 'by you using the secure unlock process',
      admin: 'by an administrator'
    }[unlockedBy];

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Unlocked</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-box { background: #d4edda; border: 2px solid #27ae60; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .login-button { display: inline-block; background: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Account Unlocked</h1>
              <p>You can now access your Soul Wallet account</p>
            </div>
            <div class="content">
              <div class="success-box">
                <h2>Your account is now accessible</h2>
                <p>Your Soul Wallet account (${email}) has been unlocked ${unlockedByText}.</p>
              </div>
              
              <p>You can now log in to your account normally. For your security, we recommend:</p>
              
              <ul>
                <li>Change your password if you suspect it may have been compromised</li>
                <li>Use a strong password and keep your account secure</li>
                <li>Review your recent account activity</li>
                <li>Remove any unfamiliar devices from your account</li>
              </ul>
              
              <div style="text-align: center;">
                <a href="#" class="login-button">Log In to Your Account</a>
              </div>
              
              <p><strong>Still having trouble?</strong> Contact our support team if you continue to experience login issues.</p>
            </div>
            <div class="footer">
              <p>© 2024 Soul Wallet. All rights reserved.</p>
              <p>This is an automated notification. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
✅ ACCOUNT UNLOCKED - Soul Wallet

Your Soul Wallet account (${email}) has been unlocked ${unlockedByText}.

You can now log in to your account normally. For your security, we recommend:
- Change your password if you suspect it may have been compromised
- Use a strong password and keep your account secure
- Review your recent account activity
- Remove any unfamiliar devices from your account

Still having trouble? Contact our support team if you continue to experience login issues.

© 2024 Soul Wallet. All rights reserved.
This is an automated notification. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Parse user agent string to extract device information
   */
  private parseUserAgent(userAgent: string): { device: string; browser: string; os: string } {
    // Simple user agent parsing - in production, consider using a library like ua-parser-js
    const device = /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'Mobile Device' : 'Desktop/Laptop';

    let browser = 'Unknown Browser';
    if (userAgent.includes('Chrome')) browser = 'Google Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Microsoft Edge';

    let os = 'Unknown OS';
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    return { device, browser, os };
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, resetCode: string): Promise<void> {
    const template = this.generatePasswordResetTemplate(resetCode, email);
    await this.sendEmail(email, template);
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string): Promise<void> {
    const template = this.generateWelcomeTemplate(email);
    await this.sendEmail(email, template);
  }

  async sendLoginNotification(
    email: string,
    ipAddress: string,
    userAgent: string,
    timestamp: Date
  ): Promise<void> {
    const template = this.generateLoginNotificationTemplate(email, ipAddress, userAgent, timestamp)
    await this.sendEmail(email, template)
  }

  /**
   * Send suspicious login alert email
   */
  async sendSuspiciousLoginAlert(
    email: string,
    ipAddress: string,
    userAgent: string,
    location?: string,
    timestamp?: Date
  ): Promise<void> {
    const template = this.generateSuspiciousLoginTemplate(email, ipAddress, userAgent, location, timestamp);
    await this.sendEmail(email, template);
  }

  /**
   * Send account lockout notification email
   */
  async sendAccountLockoutNotification(
    email: string,
    lockoutDuration: number,
    failedAttempts: number,
    lastAttemptIp?: string
  ): Promise<void> {
    const template = this.generateAccountLockoutTemplate(email, lockoutDuration, failedAttempts, lastAttemptIp);
    await this.sendEmail(email, template);
  }

  /**
   * Send account unlocked notification email
   */
  async sendAccountUnlockedNotification(
    email: string,
    unlockedBy: 'auto' | 'user' | 'admin' = 'auto'
  ): Promise<void> {
    const template = this.generateAccountUnlockedTemplate(email, unlockedBy);
    await this.sendEmail(email, template);
  }

  /**
   * Send email using configured provider
   */
  private async sendEmail(to: string, template: EmailTemplate): Promise<void> {
    try {
      switch (this.config.provider) {
        case 'console':
          // Audit Issue #3: Only log in development, mask sensitive data
          if (process.env.NODE_ENV === 'development') {
            const maskedEmail = to.length > 3 ? to.substring(0, 3) + '***@***' : '***@***';
            logger.debug('Email sent (console mode)', {
              to: maskedEmail,
              subject: template.subject,
              // Never log content - may contain OTP codes
            });
          }
          break;

        case 'resend':
          await this.sendWithResend(to, template);
          break;

        case 'sendgrid':
        case 'smtp':
          if (!this.transporter) {
            throw new Error('Email transporter not initialized');
          }

          await this.transporter.sendMail({
            from: `${this.config.fromName} <${this.config.fromEmail}>`,
            to,
            subject: template.subject,
            html: template.html,
            text: template.text,
          });
          break;

        default:
          throw new Error(`Unsupported email provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send email using Resend API
   */
  private async sendWithResend(to: string, template: EmailTemplate): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('Resend API key not configured');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: [to],
        subject: template.subject,
        html: template.html,
        text: template.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${error}`);
    }
  }

  /**
   * Verify email configuration
   */
  async verifyConfiguration(): Promise<boolean> {
    try {
      switch (this.config.provider) {
        case 'console':
          return true;

        case 'smtp':
        case 'sendgrid':
          if (!this.transporter) {
            return false;
          }
          await this.transporter.verify();
          return true;

        case 'resend': {
          if (!this.config.apiKey) {
            return false;
          }
          const response = await fetch('https://api.resend.com/domains', {
            headers: {
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
          });
          return response.ok;
        }

        default:
          return false;
      }
    } catch (error) {
      logger.error('Email configuration verification failed:', error);
      return false;
    }
  }
}

// Default email service instance
export const createEmailService = (): EmailService => {
  const config: EmailConfig = {
    provider: (process.env.EMAIL_PROVIDER as any) || 'console',
    fromEmail: process.env.FROM_EMAIL || 'noreply@soulwallet.com',
    fromName: process.env.FROM_NAME || 'Soul Wallet',
    ...(process.env.EMAIL_API_KEY ? { apiKey: process.env.EMAIL_API_KEY } : {}),
    ...(process.env.SMTP_HOST ? { smtpHost: process.env.SMTP_HOST } : {}),
    ...(process.env.SMTP_PORT ? { smtpPort: parseInt(process.env.SMTP_PORT) } : {}),
    ...(process.env.SMTP_USER ? { smtpUser: process.env.SMTP_USER } : {}),
    ...(process.env.SMTP_PASS ? { smtpPass: process.env.SMTP_PASS } : {}),
  };

  return new EmailService(config);
};
