import {Controller, Get, Param,} from '@nestjs/common';
import { SearchService } from '../services/search.service';

@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
  ) {}

  @Get(':barcode')
  search(
    @Param('barcode') barcode: string,
  ) {
    return this.searchService.search(barcode);
  }
}