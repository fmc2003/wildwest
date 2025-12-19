// mailer.js
//module to send emails using nodemailer
//unimplemented due to digital ocean disabling SMTP on droplets

const nodemailer = require('nodemailer');


//create transporter using gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

//function to send password reset email
async function sendResetEmail(to, token) {
  const resetLink = `${process.env.BASE_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'Password Reset Request',
    html: `
      <p>You requested a password reset.</p>
      <p>This link expires in <strong>15 minutes</strong>.</p>
      <p>
        <a href="${resetLink}">Reset Password</a>
      </p>
      <p>If you did not request this, ignore this email.</p>
    `
  });
}

module.exports = { sendResetEmail };
