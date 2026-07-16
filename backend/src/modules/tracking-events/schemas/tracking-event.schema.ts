import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TrackingEventDocument = TrackingEvent & Document;

// Alta escritura, poco relacional: vive en MongoDB Atlas en vez de Postgres
// (ver docs/ARQUITECTURA.md). shipmentId y tenantId son ids de Postgres,
// no ObjectId de Mongo — se referencian por valor, no por relación.
@Schema({ timestamps: true, collection: 'tracking_events' })
export class TrackingEvent {
  @Prop({ required: true, index: true })
  shipmentId: string;

  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  codigoGuia: string;

  @Prop({ required: true })
  estado: string;

  @Prop()
  ubicacion?: string;

  @Prop()
  descripcion?: string;

  @Prop()
  lat?: number;

  @Prop()
  lng?: number;

  // Origen del evento: registro manual de un operador vs. futura integración
  // automática con la API de una naviera/aerolínea (webhook).
  @Prop({ default: 'manual' })
  fuente: 'manual' | 'api_carrier';

  @Prop({ required: true })
  responsable: string;

  @Prop({ required: true, default: () => new Date() })
  timestamp: Date;
}

export const TrackingEventSchema = SchemaFactory.createForClass(TrackingEvent);
TrackingEventSchema.index({ codigoGuia: 1, timestamp: -1 });
