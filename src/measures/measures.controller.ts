import { Controller, Post, Body, HttpCode, Patch, Get, Param, Query, Req } from '@nestjs/common';
import { MeasuresService } from './services/measures.service';
import { CreateMeasureDto } from './dto/create-measure.dto';
import { ConfirmMeasureDto } from './dto/confirm-measure.dto';
import { Request } from 'express';


@Controller()
export class MeasuresController {
  constructor(
    private readonly measuresService: MeasuresService,
  ) {}

  @Post('upload')
  @HttpCode(200)
  async createMeasure(
    @Body() createMeasureDto: CreateMeasureDto,
    @Req() req: Request,
  ) {
    const thisUrlPath = `${req.protocol}://${req.get('host')}`
    const measureServiceResult = await this.measuresService.create(createMeasureDto, thisUrlPath);
    return measureServiceResult
  }

  @Patch('confirm')
  @HttpCode(200)
  async confirmMeasure(@Body() confirmMeasureDto: ConfirmMeasureDto) {
    const result = await this.measuresService.confirm(confirmMeasureDto);
    return result;
  }

  @Get(':customer_code/list')
  async listMeasures(
    @Req() req: Request,
    @Param('customer_code') customer_code: string,
    @Query('measure_type') measure_type?: string
  ) {
    const thisUrlPath = `${req.protocol}://${req.get('host')}`
    const result = await this.measuresService.list(thisUrlPath, customer_code, measure_type);
    return result;
  }

}