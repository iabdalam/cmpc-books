import { PartialType } from '@nestjs/swagger';
import { CreateBookDto } from './create-book.dto';

// Omitir campos es válido; null solo se admite en imageUrl, no en campos obligatorios.
export class UpdateBookDto extends PartialType(CreateBookDto, { skipNullProperties: false }) {}
