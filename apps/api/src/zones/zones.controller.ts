import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('zones')
@Controller('zones')
export class ZonesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Active delivery zones with per-zone fee/min-order/COD-cap config' })
  list() {
    return this.prisma.zone.findMany({
      where: { isActive: true, city: { isActive: true } },
      select: {
        id: true,
        name: true,
        deliveryFeeInr: true,
        minOrderInr: true,
        codCapInr: true,
        city: { select: { id: true, name: true, state: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
