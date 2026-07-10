import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { FirebaseService } from './firebase.service';
import { PrismaService } from '../prisma/prisma.service';

export type TokenKind = 'admin' | 'shop' | 'customer';

export interface JwtPayload {
  sub: string;
  kind: TokenKind;
  role?: string;
  shopId?: string;
}

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
}
