import { Injectable, NotFoundException,} from '@nestjs/common';
import { PrismaService }
from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

async search(barcode: string) {
  // Package
  const packageSnapshot =
    await this.prisma.packageSnapshot.findUnique({
      where: { trackingNumber: barcode },
    });

  if (packageSnapshot) {
    return {
      type: 'PACKAGE',
      data: packageSnapshot,
    };
  }

  // Container
  const containerSnapshot =
    await this.prisma.containerSnapshot.findUnique({
      where: { containerBarcode: barcode },
    });

  if (containerSnapshot) {
    return {
      type: 'CONTAINER',
      data: containerSnapshot,
    };
  }

  // Trailer
  const trailerSnapshot =
    await this.prisma.trailerSnapshot.findUnique({
      where: { trailerBarcode: barcode },
    });

  if (trailerSnapshot) {
    return {
      type: 'TRAILER',
      data: trailerSnapshot,
    };
  }

  throw new NotFoundException(
    'Asset not found',
  );
}

}