import { Transform } from 'class-transformer';
import { IsByteLength, IsEmail, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ format: 'email', example: 'demo@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ format: 'password', writeOnly: true, minLength: 1,
    description: 'Contraseña del usuario (máximo 72 bytes UTF-8).' })
  @IsString()
  // bcrypt solo procesa 72 bytes; rechazar el exceso evita aceptar sufijos ignorados.
  @IsByteLength(1, 72)
  password!: string;
}
