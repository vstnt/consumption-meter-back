import { IsString, IsInt, IsUUID } from 'class-validator';


export class ConfirmMeasureDto {
  
  @IsUUID()
  measure_uuid: string;

  @IsInt({ message: 'o valor confirmado deve ser uma integral.' })
  confirmed_value: number;
  
}