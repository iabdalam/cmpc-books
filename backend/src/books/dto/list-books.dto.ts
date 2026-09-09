import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookFiltersDto } from './book-filters.dto';

function integer(value: unknown): unknown {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
}

export class ListBooksDto extends BookFiltersDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 })
  @Transform(({ value }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(({ value }) => integer(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ example: 'title:asc,price:desc', default: 'createdAt:desc',
    description: 'Campos: title, price, available, createdAt, updatedAt, id. Direcciones asc/desc. Sin campos repetidos.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sort?: string;
}
