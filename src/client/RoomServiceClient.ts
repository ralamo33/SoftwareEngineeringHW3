import axios, {AxiosInstance, AxiosResponse} from 'axios';
import assert from 'assert';
import {
  ResponseEnvelope,
  RoomCreateRequest,
  RoomCreateResponse,
  RoomDeleteRequest,
  RoomJoinRequest,
  RoomJoinResponse,
  RoomListResponse,
  RoomUpdateRequest,
} from '../requestHandlers/CoveyRoomRequestHandlers';

export default class RoomServiceClient {
  private _axios: AxiosInstance;

  constructor(serviceURL: string) {
    this._axios = axios.create({
      baseURL: serviceURL,
    });
  }

  static unwrapOrThrowError<T>(response: AxiosResponse<ResponseEnvelope<T>>, ignoreResponse = false): T {
    if (response.data.isOK) {
      if (ignoreResponse) {
        return {} as T;
      }
      assert(response.data.response);
      return response.data.response;
    }
    throw new Error(`Error processing request: ${response.data.message}`);
  }

  async createRoom(requestData: RoomCreateRequest): Promise<RoomCreateResponse> {
    const responseWrapper = await this._axios.post<ResponseEnvelope<RoomCreateResponse>>('/rooms', requestData);
    return RoomServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async updateRoom(requestData: RoomUpdateRequest): Promise<void> {
    const responseWrapper = await this._axios.patch<ResponseEnvelope<void>>(`/rooms/${requestData.coveyRoomID}`, requestData);
    RoomServiceClient.unwrapOrThrowError(responseWrapper, true);
  }

  async deleteRoom(requestData: RoomDeleteRequest): Promise<void> {
    const responseWrapper = await this._axios.delete<ResponseEnvelope<void>>(`/rooms/${requestData.coveyRoomID}/${requestData.coveyRoomPassword}`);
    RoomServiceClient.unwrapOrThrowError(responseWrapper, true);
  }

  async listRooms(): Promise<RoomListResponse> {
    const responseWrapper = await this._axios.get<ResponseEnvelope<RoomListResponse>>('/rooms');
    return RoomServiceClient.unwrapOrThrowError(responseWrapper);
  }

  async joinRoom(requestData: RoomJoinRequest): Promise<RoomJoinResponse> {
    const responseWrapper = await this._axios.post('/sessions', requestData);
    return RoomServiceClient.unwrapOrThrowError(responseWrapper);
  }

}
