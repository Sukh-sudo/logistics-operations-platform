import {Controller, Get, Param, Query,} from '@nestjs/common';
import { SearchService } from '../services/search.service';
import { SearchQueryDto } from '../dto/search-query.dto';

@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
  ) {}

  @Get()
  searchByQuery(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.q, query.type);
  }

  /** Backward-compatible alias for barcode scanners using the original route. */
  @Get(':barcode')
  search(
    @Param('barcode') barcode: string,
  ) {
    return this.searchService.search(barcode);
  }
}
