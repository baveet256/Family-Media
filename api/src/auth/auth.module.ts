import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { resolveJwtSecret } from '../config/env.validation';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = config.get<string>('JWT_EXPIRES_IN') ?? '30d';
        return {
          // Throws at boot in production rather than falling back to a
          // publicly known secret.
          secret: resolveJwtSecret(config.get<string>('JWT_SECRET')),
          signOptions: {
            // nest/jwt types expect ms StringValue | number
            expiresIn: expiresIn as `${number}d`,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule {}
