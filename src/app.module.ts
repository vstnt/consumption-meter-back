import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeasuresModule } from './measures/measures.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'consumption_meter_user',
      password: 'testeshopper',
      database: 'consumption_meter_db',
      entities: [],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([]), // isso fica?
    MeasuresModule,
  ],
})
export class AppModule {}
