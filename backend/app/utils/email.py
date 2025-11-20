import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
from app.utils.logger import logger

async def send_email(to: str, subject: str, html: str, text: str = ""):
    """发送邮件"""
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = settings.SMTP_FROM
        msg['To'] = to
        
        if text:
            msg.attach(MIMEText(text, 'plain'))
        msg.attach(MIMEText(html, 'html'))
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(msg)
        
        logger.info(f"邮件发送成功: {to}")
    except Exception as e:
        logger.error(f"邮件发送失败: {e}")
        raise

async def send_verification_email(email: str, verification_token: str):
    """发送验证邮件"""
    frontend_url = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:7777"
    verification_url = f"{frontend_url}/verify-email?token={verification_token}"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>欢迎注册量化监控系统</h2>
      <p>请点击以下链接验证您的邮箱：</p>
      <p><a href="{verification_url}" style="display: inline-block; padding: 10px 20px; background-color: #1890ff; color: white; text-decoration: none; border-radius: 4px;">验证邮箱</a></p>
      <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
      <p style="word-break: break-all;">{verification_url}</p>
      <p>此链接24小时内有效。</p>
    </div>
    """
    
    return await send_email(
        email,
        "验证您的邮箱 - 量化监控系统",
        html,
        f"请访问以下链接验证您的邮箱：{verification_url}"
    )

async def send_password_reset_email(email: str, reset_token: str):
    """发送密码重置邮件"""
    frontend_url = settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:7777"
    reset_url = f"{frontend_url}/reset-password?token={reset_token}"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>重置密码</h2>
      <p>您请求重置密码，请点击以下链接：</p>
      <p><a href="{reset_url}" style="display: inline-block; padding: 10px 20px; background-color: #1890ff; color: white; text-decoration: none; border-radius: 4px;">重置密码</a></p>
      <p>如果按钮无法点击，请复制以下链接到浏览器：</p>
      <p style="word-break: break-all;">{reset_url}</p>
      <p>此链接1小时内有效。如果您没有请求重置密码，请忽略此邮件。</p>
    </div>
    """
    
    return await send_email(
        email,
        "重置密码 - 量化监控系统",
        html,
        f"请访问以下链接重置密码：{reset_url}"
    )

