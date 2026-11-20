import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
@Entity()
export class Catergory {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column()
  name: string;
  @Column()
  image: string;
}
