import { Transform } from 'class-transformer';
import { IsString, IsDate, IsDateString, IsIn } from 'class-validator';

export class CreateMeasureDto {
  
  image: string;
  
  @IsString({ message: 'o código do cliente deve ser uma string válida.' })
  customer_code: string;
  
  @IsDateString()
  measure_datetime: string;

  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase() : value)
  @IsIn(['WATER', 'GAS'], { message: 'o tipo de medição deve ser "WATER" ou "GAS".' })
  measure_type: string;
  
}