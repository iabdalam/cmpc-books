import { ApiProperty } from '@nestjs/swagger';
import { BookResponseDto } from './book-response.dto';

export class PaginationDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class BookPageDto {
  @ApiProperty({ type: BookResponseDto, isArray: true }) data!: BookResponseDto[];
  @ApiProperty({ type: PaginationDto }) meta!: PaginationDto;
}
