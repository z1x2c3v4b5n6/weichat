import { Body, Controller, Post } from '@nestjs/common';
import { AuthService, AuthTokens } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { RefreshDto } from './dto/refresh.dto';
import { JwtService } from '@nestjs/jwt';

interface RefreshPayload {
  sub: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly jwtService: JwtService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthTokens> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto): Promise<AuthTokens> {
    const payload = await this.jwtService.verifyAsync<RefreshPayload>(dto.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'refresh'
    });
    return this.authService.refresh(payload.sub, dto.refreshToken);
  }
}
