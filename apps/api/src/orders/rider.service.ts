import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Rider profile, duty shifts, and live-location ingest. The order flow itself
 * lives in OrderActionsService; this handles the "who am I / am I on duty /
 * where am I" surface the rider app polls and pushes to.
 */
@Injectable()
export class RiderService {
  constructor(private readonly prisma: PrismaService) {}

  /** Profile shown on the rider's Home/Profile: identity, duty, COD cash-in-hand, active task count. */
  async me(riderId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleNo: true,
        isActive: true,
        isOnDuty: true,
        cashInHandInr: true,
        lastSeenAt: true,
      },
    });
    if (!rider) throw new NotFoundException('Rider not found');
    const activeTasks = await this.prisma.deliveryAssignment.count({
      where: {
        riderId,
        order: { state: { in: ['RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] } },
      },
    });
    return { ...rider, activeTasks };
  }

  /** Go on/off duty. Off-duty riders keep their active tasks but stop being offered new ones. */
  async setDuty(riderId: string, onDuty: boolean) {
    const rider = await this.prisma.rider.update({
      where: { id: riderId },
      data: { isOnDuty: onDuty },
      select: { id: true, isOnDuty: true },
    });
    return rider;
  }

  /**
   * Live-location ping from the rider app (foreground service, ~every few
   * seconds while on duty). We keep the latest fix on the rider row for the
   * admin map and append a sampled point to RiderLocation history. At scale the
   * live fix moves to Redis GEO and the Socket.IO fan-out to customers.
   */
  async recordLocation(riderId: string, lat: number, lng: number) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.rider.update({
        where: { id: riderId },
        data: { lastLat: lat, lastLng: lng, lastSeenAt: now },
      }),
      this.prisma.riderLocation.create({
        data: { riderId, lat, lng, recordedAt: now },
      }),
    ]);
    return { ok: true, recordedAt: now };
  }
}
