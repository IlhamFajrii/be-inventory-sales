import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './login.dto';

// Dibandingkan saat email tidak ada, supaya waktu respons tidak membocorkan keberadaan akun.
const DUMMY_HASH = bcrypt.hashSync('tidak-dipakai', 10);

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    // Pesan sama untuk "email tidak ada" dan "password salah".
    if (!user || !ok) throw new UnauthorizedException('Email atau password salah');
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
    };
  }
}
