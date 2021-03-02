import { nanoid } from 'nanoid';
import { Socket } from 'socket.io';
import assert from 'assert';
import {
  ResponseEnvelope,
  roomCreateHandler, RoomCreateResponse,
  roomJoinHandler,
  RoomJoinRequest,
  roomSubscriptionHandler,
} from './CoveyRoomRequestHandlers';

const mockSocketEmitFunction = jest.fn();
const mockSocketDisconnectFunction = jest.fn();
const mockSocketOnFunction = jest.fn();

export function unwrapResponse<T>(response: ResponseEnvelope<T>): T {
  assert(response.response);
  return response.response;
}

export async function createRoomForTesting() : Promise<RoomCreateResponse> {
  return unwrapResponse(await roomCreateHandler({
    isPubliclyListed: false,
    friendlyName: `TestingRoom-${nanoid()}`,
  }));
}

describe('roomJoinHandler', () => {
  it('should retrieve the same coveyRoomController for multiple requests on the same room', async () => {
    const createdRoomCreds = await createRoomForTesting();
    const requestData: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds.coveyRoomID,
      userName: nanoid(),
    };
    const firstResponse = unwrapResponse(await roomJoinHandler(requestData));
    expect(firstResponse.currentPlayers.length)
      .toBe(1); // Should start out with just us

    const requestDataForSameRoom: RoomJoinRequest = {
      coveyRoomID: requestData.coveyRoomID,
      userName: nanoid(),
    };
    const secondResponse = unwrapResponse(await roomJoinHandler(requestDataForSameRoom));
    expect(secondResponse.currentPlayers.length)
      .toBe(2); // Should have first player too
  });
  it('should support multiple rooms', async () => {
    const createdRoomCreds = await createRoomForTesting();
    const requestData: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds.coveyRoomID,
      userName: nanoid(),
    };
    const firstResponse = unwrapResponse(await roomJoinHandler(requestData));
    expect(firstResponse.currentPlayers.length)
      .toBe(1); // Should start out with just us

    const secondCreatedRoomCreds = unwrapResponse(await roomCreateHandler({
      isPubliclyListed: false,
      friendlyName: nanoid(),
    }));
    const requestDataForDifferentRoom: RoomJoinRequest = {
      coveyRoomID: secondCreatedRoomCreds.coveyRoomID,
      userName: nanoid(),
    };
    const secondResponse = unwrapResponse(await roomJoinHandler(requestDataForDifferentRoom));
    expect(secondResponse.currentPlayers.length)
      .toBe(1); // should be a different room

    const requestDataForSameRoom: RoomJoinRequest = {
      coveyRoomID: requestData.coveyRoomID,
      userName: nanoid(),
    };
    const lastResponse = unwrapResponse(await roomJoinHandler(requestDataForSameRoom));
    expect(lastResponse.currentPlayers.length)
      .toBe(2); // Should have first player too
  });

  it('should fail if the room does not exist', async () => {
    const response = await roomJoinHandler({
      coveyRoomID: 'invalidRoomID',
      userName: nanoid(),
    });
    expect(response.isOK)
      .toBe(false);
  });
});

function mockSocket(coveyRoomID: string, coveySessionToken: string): Socket {
  return {
    // eslint-disable-next-line
    // @ts-ignore - we knowingly don't implement the actual socket API here
    handshake: {
      auth: {
        token: coveySessionToken,
        coveyRoomID,
      },
    },
    // eslint-disable-next-line
    // @ts-ignore
    disconnect: (param: boolean) => {
      mockSocketDisconnectFunction(param);
    },
    // eslint-disable-next-line
    // @ts-ignore
    emit: (event: string, payload: Record<unknown, unknown>) => {
      mockSocketEmitFunction(event, payload);
    },
    // eslint-disable-next-line
    // @ts-ignore
    on: (event: string, callback: Record<unknown, unknown>) => {
      mockSocketOnFunction(event, callback);
    },
  };
}

describe('roomSubscriptionHandler', () => {
  beforeEach(() => {
    mockSocketDisconnectFunction.mockClear();
    mockSocketEmitFunction.mockClear();
    mockSocketOnFunction.mockClear();
  });

  // it should fail if not a valid room
  it('should accept a connection with a valid room and session token', async () => {

    const createdRoomCreds = await createRoomForTesting();

    const preFlightRequestData: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds.coveyRoomID,
      userName: nanoid(),
    };

    const preFlightResponse = unwrapResponse(await roomJoinHandler(preFlightRequestData));
    roomSubscriptionHandler(
      mockSocket(preFlightRequestData.coveyRoomID, preFlightResponse.coveySessionToken),
    );
    expect(mockSocketDisconnectFunction.mock.calls.length)
      .toBe(0); // This was a valid session token, should not have called disconnect
  });
  it('should accept a connection with a valid room and session token, and allow that token to be reused if the session is not destroyed', async () => {
    const createdRoomCreds = await createRoomForTesting();

    const preFlightRequestData: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds.coveyRoomID,
      userName: nanoid(),
    };
    const preFlightResponse = unwrapResponse(await roomJoinHandler(preFlightRequestData));
    roomSubscriptionHandler(
      mockSocket(preFlightRequestData.coveyRoomID, preFlightResponse.coveySessionToken),
    );
    roomSubscriptionHandler(
      mockSocket(preFlightRequestData.coveyRoomID, preFlightResponse.coveySessionToken),
    );
    roomSubscriptionHandler(
      mockSocket(preFlightRequestData.coveyRoomID, preFlightResponse.coveySessionToken),
    );
    expect(mockSocketDisconnectFunction.mock.calls.length)
      .toBe(0); // This was a valid session token, should not have called disconnect
  });
  it('should accept a connection with a valid room and session token, then no longer accept it once that client disconnects', async () => {

    const createdRoomCreds = await createRoomForTesting();

    const preFlightRequestData: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds.coveyRoomID,
      userName: nanoid(),
    };
    const preFlightResponse = unwrapResponse(await roomJoinHandler(preFlightRequestData));

    roomSubscriptionHandler(
      mockSocket(preFlightRequestData.coveyRoomID, preFlightResponse.coveySessionToken),
    );
    // If all went correctly in roomSubscriptionHandler, the disconnect handler should have been
    // registered
    const disconnectCallback = mockSocketOnFunction.mock.calls.find(
      call => call[0] === 'disconnect',
    );
    assert(disconnectCallback);
    // Call that disconnect callback, which should destroy this session
    disconnectCallback[1]();

    roomSubscriptionHandler(
      mockSocket(preFlightRequestData.coveyRoomID, preFlightResponse.coveySessionToken),
    );
    expect(mockSocketDisconnectFunction.mock.calls.length)
      .toBe(1); // That session token should have been destroyed in the server
  });
  it('should reject a connection without a valid session token for the room', async () => {
    const createdRoomCreds = await createRoomForTesting();

    const preFlightRequestData: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds.coveyRoomID,
      userName: nanoid(),
    };

    const preFlightResponse = unwrapResponse(await roomJoinHandler(preFlightRequestData));

    roomSubscriptionHandler(
      mockSocket(preFlightRequestData.coveyRoomID, preFlightResponse.coveySessionToken),
    );
    expect(mockSocketDisconnectFunction.mock.calls.length)
      .toBe(0); // This was a valid session token, should not have called disconnect

    const preFlightRequestData2: RoomJoinRequest = {
      coveyRoomID: preFlightRequestData.coveyRoomID,
      userName: nanoid(),
    };
    await roomJoinHandler(preFlightRequestData2);
    roomSubscriptionHandler(mockSocket(preFlightRequestData.coveyRoomID, nanoid()));
    expect(mockSocketDisconnectFunction.mock.calls.length)
      .toBe(1); // This was a not valid session token, should have called disconnect
  });
  it("should reject a connection without a valid session token for the room, even if it's valid for another room", async () => {

    const createdRoomCreds = await createRoomForTesting();

    const createdRoomCreds2 = await createRoomForTesting();

    const request1: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds.coveyRoomID,
      userName: nanoid(),
    };
    const preFlightResponse = unwrapResponse(await roomJoinHandler(request1));
    const request2: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds2.coveyRoomID,
      userName: nanoid(),
    };
    await roomJoinHandler(request2);
    roomSubscriptionHandler(mockSocket(request2.coveyRoomID, preFlightResponse.coveySessionToken));
    expect(mockSocketDisconnectFunction.mock.calls.length)
      .toBe(1); // This was a valid session token, should not have called disconnect
  });
  it('should accept a connection with a valid session token for the room, regardless of order those tokens were issued', async () => {
    const createdRoomCreds = await createRoomForTesting();
    const createdRoomCreds2 = await createRoomForTesting();

    const request1: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds.coveyRoomID,
      userName: nanoid(),
    };
    const preFlightResponse = unwrapResponse(await roomJoinHandler(request1));
    const request2: RoomJoinRequest = {
      coveyRoomID: createdRoomCreds2.coveyRoomID,
      userName: nanoid(),
    };
    const preFlightResponse2 = unwrapResponse(await roomJoinHandler(request2));

    roomSubscriptionHandler(mockSocket(request2.coveyRoomID, preFlightResponse2.coveySessionToken));
    roomSubscriptionHandler(mockSocket(request1.coveyRoomID, preFlightResponse.coveySessionToken));

    expect(mockSocketDisconnectFunction.mock.calls.length)
      .toBe(0); // This was a valid session token, should not have called disconnect
  });
});
