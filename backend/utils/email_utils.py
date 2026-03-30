import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from dotenv import load_dotenv

load_dotenv()

conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def send_reset_password_email(email: EmailStr, reset_link: str):
    html = f"""
    <html>
    <body>
        <h2>Réinitialisation de votre mot de passe Juriva</h2>
        <p>Bonjour,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Juriva.</p>
        <p>Veuillez cliquer sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
        <div style="margin: 20px 0;">
            <a href="{reset_link}" style="background-color: #1a73e8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Réinitialiser mon mot de passe
            </a>
        </div>
        <p>Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
        <p>Cordialement,<br>L'équipe Juriva</p>
        <hr>
        <p style="font-size: 0.8em; color: #666;">Si le bouton ne fonctionne pas, copiez et collez le lien suivant dans votre navigateur :<br>{reset_link}</p>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="Réinitialisation de mot de passe Juriva",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)
