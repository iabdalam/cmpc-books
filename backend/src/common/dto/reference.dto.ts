import { ApiProperty } from '@nestjs/swagger';

export class ReferenceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}
