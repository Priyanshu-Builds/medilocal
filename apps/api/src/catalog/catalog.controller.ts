import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('medicines')
  @ApiOperation({ summary: 'List/search medicines (fuzzy: tolerates misspellings like "dollo")' })
  @ApiQuery({ name: 'q', required: false, description: 'Search text (min 2 chars); omit to list' })
  search(@Query('q') q?: string) {
    return this.catalog.searchMedicines(q);
  }
}
