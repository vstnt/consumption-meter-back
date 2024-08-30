import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Measure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customer_code: string;

  @Column()
  measure_datetime: Date;

  @Column()
  measure_value: number;

  @Column()
  measure_type: string;

  @Column({ default: false })
  is_confirmed: boolean;

  @Column({ nullable: true })
  image_url: string;

  @Column({ type: 'text', nullable: true })
  image_data: string;

  @Column({ type: 'timestamp', nullable: true })
  image_expiration: Date;
}
