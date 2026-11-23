import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
@Entity()
export class Catergory {
  @PrimaryGeneratedColumn()
  id: string;
  @Column()
  name: string;
  @Column()
  image: string;
}
