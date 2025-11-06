import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './constants';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
