import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { FirebaseService } from '../firebase/firebase.service';
import { last10Digits } from '../common/phone';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload, TokenKind } from '../common/jwt-payload';

export type { JwtPayload, TokenKind };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
  ) {}

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '30d',
    });
    return { accessToken, refreshToken };
  }

  async adminLogin(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.isActive || !bcrypt.compareSync(password, admin.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.issueTokens({ sub: admin.id, kind: 'admin', role: admin.role });
    return { ...tokens, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } };
  }

  async shopLogin(email: string, password: string) {
    const staff = await this.prisma.shopStaff.findUnique({
      where: { email },
      include: { shop: true },
    });
    if (!staff || !staff.isActive || !bcrypt.compareSync(password, staff.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.issueTokens({ sub: staff.id, kind: 'shop', shopId: staff.shopId });
    return {
      ...tokens,
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        isPharmacist: staff.isPharmacist,
        shop: { id: staff.shop.id, name: staff.shop.name },
      },
    };
  }

  /**
   * Customer login: the Flutter app completes Firebase Phone Auth and sends the
   * Firebase ID token; we verify it, upsert the user by phone, and issue our own JWTs.
   */
  async customerFirebaseLogin(idToken: string) {
    const decoded = await this.firebase.verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) {
      throw new UnauthorizedException('Firebase token has no phone number');
    }
    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { firebaseUid: decoded.uid },
      create: { phone, firebaseUid: decoded.uid },
    });
    if (user.isBlocked) {
      throw new UnauthorizedException('Account blocked');
    }
    const tokens = await this.issueTokens({ sub: user.id, kind: 'customer' });
    return { ...tokens, user: { id: user.id, phone: user.phone, name: user.name } };
  }

  /**
   * Rider login uses the same Firebase phone OTP, but riders are pre-created by
   * admin — an unknown phone is rejected, never auto-registered.
   */
  async riderFirebaseLogin(idToken: string) {
    const decoded = await this.firebase.verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) {
      throw new UnauthorizedException('Firebase token has no phone number');
    }
    const rider = await this.findRiderByPhone(phone);
    if (!rider || !rider.isActive) {
      throw new UnauthorizedException('No active rider account for this phone number');
    }
    const tokens = await this.issueTokens({ sub: rider.id, kind: 'rider' });
    return { ...tokens, user: { id: rider.id, phone: rider.phone, name: rider.name } };
  }

  /**
   * Dev-only token mint so the order flow can be exercised locally / in e2e
   * tests without a Firebase project. Hard-disabled unless DEV_LOGIN_ENABLED=true
   * and not running in production.
   */
  async devLogin(kind: 'customer' | 'rider', phone: string) {
    const enabled =
      this.config.get('DEV_LOGIN_ENABLED') === 'true' &&
      this.config.get('NODE_ENV') !== 'production';
    if (!enabled) {
      throw new ForbiddenException('Dev login is disabled on this server');
    }

    if (kind === 'rider') {
      const rider = await this.findRiderByPhone(phone);
      if (!rider || !rider.isActive) {
        throw new UnauthorizedException('No active rider with this phone');
      }
      const tokens = await this.issueTokens({ sub: rider.id, kind: 'rider' });
      return { ...tokens, user: { id: rider.id, phone: rider.phone, name: rider.name } };
    }

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone },
    });
    const tokens = await this.issueTokens({ sub: user.id, kind: 'customer' });
    return { ...tokens, user: { id: user.id, phone: user.phone, name: user.name } };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      return this.issueTokens({
        sub: payload.sub,
        kind: payload.kind,
        role: payload.role,
        shopId: payload.shopId,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async findRiderByPhone(phone: string) {
    const riders = await this.prisma.rider.findMany({ where: { isActive: true } });
    const needle = last10Digits(phone);
    return riders.find((r) => last10Digits(r.phone) === needle) ?? null;
  }
}
