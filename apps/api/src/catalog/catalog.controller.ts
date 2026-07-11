import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminRoles, Auth } from '../common/auth.decorator';
import { CatalogService } from './catalog.service';
import { CreateMedicineDto, ImportCsvDto, UpdateMedicineDto } from './dto';

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

@ApiTags('admin')
@Controller('admin/medicines')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @Auth('admin')
  @ApiOperation({ summary: 'Master catalog list (includes inactive)' })
  @ApiQuery({ name: 'q', required: false })
  list(@Query('q') q?: string) {
    return this.catalog.adminList(q);
  }

  @Post()
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({ summary: 'Add a medicine to the master catalog' })
  create(@Body() dto: CreateMedicineDto) {
    return this.catalog.createMedicine(dto);
  }

  @Patch(':id')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({ summary: 'Edit a medicine / activate / deactivate' })
  update(@Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.catalog.updateMedicine(id, dto);
  }

  @Post('import')
  @Auth('admin')
  @AdminRoles('OPS')
  @ApiOperation({
    summary: 'Bulk import/upsert medicines from CSV (matched by name). Bad rows are reported, not fatal.',
  })
  import(@Body() dto: ImportCsvDto) {
    return this.catalog.importCsv(dto.csv);
  }
}
