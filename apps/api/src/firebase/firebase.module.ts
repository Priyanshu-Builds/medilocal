import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

/** Global: auth (token verification) and notifications (FCM) both need it. */
@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
