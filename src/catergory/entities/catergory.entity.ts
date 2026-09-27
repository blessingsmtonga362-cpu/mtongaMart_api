import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
@Entity()
export class Catergory {
  @PrimaryGeneratedColumn()
  id: number;
  @Column()
  name: string;
  @Column()
  image: string;
  @Column({ unique: true })
  slug: string;
}
