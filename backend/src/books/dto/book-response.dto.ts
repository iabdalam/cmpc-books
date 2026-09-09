import { ApiProperty } from '@nestjs/swagger';
import { ReferenceDto } from '../../common/dto/reference.dto';

export class BookResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ example: '12990.00', description: 'Precio decimal como cadena con dos decimales.' })
  price!: string;

  @ApiProperty()
  available!: boolean;

  @ApiProperty({ type: String, nullable: true, format: 'uri' })
  imageUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: ReferenceDto })
  author!: ReferenceDto;

  @ApiProperty({ type: ReferenceDto })
  publisher!: ReferenceDto;

  @ApiProperty({ type: ReferenceDto })
  genre!: ReferenceDto;
}
