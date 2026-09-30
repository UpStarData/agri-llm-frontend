import { request } from "./request";
import type {
  Entity,
  NeighborhoodData,
  NeighborhoodRequest,
  Relation,
} from "../types";

export const getEntity = (id: string) =>
  request<Entity>({
    url: `/entities/${encodeURIComponent(id)}`,
    method: "GET",
  });

export const getRelation = (id: string) =>
  request<Relation>({
    url: `/relations/${encodeURIComponent(id)}`,
    method: "GET",
  });

export const queryNeighborhood = (
  data: NeighborhoodRequest,
) =>
  request<NeighborhoodData>({
    url: "/graph/neighborhood",
    method: "POST",
    data,
  });
