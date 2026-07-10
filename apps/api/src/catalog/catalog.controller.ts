import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('medicines')
  @ApiOperation({
    summary:
      'List/search medicines (fuzzy: tolerates misspellings like "dollo"). Pass zoneId to only see what is in stock nearby, with the cheapest in-zone price.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Search text (min 2 chars); omit to list' })
  @ApiQuery({ name: 'zoneId', required: false, description: 'Restrict to in-stock items in this delivery zone' })
  search(@Query('q') q?: string, @Query('zoneId') zoneId?: string) {
    return this.catalog.searchMedicines(q, zoneId);
  }

  @Get('medicines/:id')
  @ApiOperation({ summary: 'Medicine detail; with zoneId includes which in-zone shops stock it' })
  @ApiQuery({ name: 'zoneId', required: false })
  get(@Param('id') id: string, @Query('zoneId') zoneId?: string) {
    return this.catalog.getMedicine(id, zoneId);
  }
}
