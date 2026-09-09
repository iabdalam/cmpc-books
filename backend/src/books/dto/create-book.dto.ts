import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsString, IsUrl, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ minimum: 0, maximum: 9999999999.99, multipleOf: 0.01, example: 12990 })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(9999999999.99)
  price!: number;

  @ApiProperty()
  @IsBoolean()
  available!: boolean;

  @ApiPropertyOptional({ type: String, format: 'uri', nullable: true, maxLength: 2048,
    description: 'URL HTTP/HTTPS opcional; null elimina la referencia a la imagen.' })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_valid_protocol: true, require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  authorId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  publisherId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  genreId!: string;
}
