import { mock, mockClear, mockReset } from 'jest-mock-extended';
import { Socket } from 'socket.io';
import { nanoid } from 'nanoid';
import TwilioVideo from './TwilioVideo';
import CoveyRoomListener from '../types/CoveyRoomListener';
import CoveyRoomController from './CoveyRoomController';
import CoveyRoomsStore from './CoveyRoomsStore';
import Player from '../types/Player';
import { roomSubscriptionHandler } from '../requestHandlers/CoveyRoomRequestHandlers';
import * as TestUtils from '../TestUtils';
import { ConfigureTest, StartTest } from '../FaultManager';
import { UserLocation, Direction } from '../CoveyTypes';
import PlayerSession from '../types/PlayerSession';

// Set up a manual mock for the getTokenForRoom function in TwilioVideo
jest.mock('./TwilioVideo');
const mockGetTokenForRoom = jest.fn();
// eslint-disable-next-line
// @ts-ignore it's a mock
TwilioVideo.getInstance = () => ({
  getTokenForRoom: mockGetTokenForRoom,
});

  /**
   * Remove the listeners from the room
   * @param room Where the listeners will be removed from
   * @param mockListeners The listeners to be removed
   * @returns The listeners that were removed
   */
  function removeListeners(room: CoveyRoomController, mockListeners: CoveyRoomListener[]): CoveyRoomListener[] {
    const removeListener1 = mockListeners[0];
    const removeListener2 = mockListeners[2];
    room.removeRoomListener(removeListener1);
    room.removeRoomListener(removeListener2);
    return [removeListener1, removeListener2];
  }




describe('CoveyRoomController', () => {
  const friendlyName = 'Friendly Name';
  let room = CoveyRoomsStore.getInstance().createRoom(friendlyName, false);
  let roomId = room.coveyRoomID;
  let player = new Player('masterchief');
  const front: Direction = 'front';
  const location: UserLocation = {
    x: 100,
    y: 100,
    rotation: front,
    moving: true,
  };
  beforeEach(() => {
    // Reset any logged invocations of getTokenForRoom before each test
    mockGetTokenForRoom.mockClear();
  });
  it.each(ConfigureTest('CRCC'))('constructor should set the friendlyName property [%s]', (testConfiguration: string) => {
    StartTest(testConfiguration);
    expect(room.friendlyName).toBe(friendlyName);
    const newRoom = new CoveyRoomController('Your True Name', false);
    expect(newRoom.friendlyName).toBe('Your True Name');
  });
  describe('addPlayer', () => {
    it.each(ConfigureTest('CRCAP'))('should use the coveyRoomID and player ID properties when requesting a video token [%s]',
      async (testConfiguration: string) => {
        StartTest(testConfiguration);
        room.addPlayer(player);
        expect(mockGetTokenForRoom).toHaveBeenCalledWith(roomId, player.id);
      });
  });
  describe('room listeners and events', () => {
    // Set up mock room listeners, you will likely find it useful to use these in the room listener tests.
    // Feel free to change these lines as you see fit, or leave them and use them as-is
    const mockListeners = [mock<CoveyRoomListener>(),
      mock<CoveyRoomListener>(),
      mock<CoveyRoomListener>()];
    mockListeners.forEach((listener) => {
      room.addRoomListener(listener);
    });
    beforeEach(() => {
      mockListeners.forEach(mockReset);
    });
    it.each(ConfigureTest('RLEMV'))('should notify added listeners of player movement when updatePlayerLocation is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      room.updatePlayerLocation(player, location);
      mockListeners.forEach((listener) => expect(listener.onPlayerMoved).toHaveBeenCalled());
    });
    it.each(ConfigureTest('RLEDC'))('should notify added listeners of player disconnections when destroySession is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      room.destroySession(new PlayerSession(player));
      mockListeners.forEach((listener) => expect(listener.onPlayerDisconnected).toHaveBeenCalled());
    });
    it.each(ConfigureTest('RLENP'))('should notify added listeners of new players when addPlayer is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      await room.addPlayer(player);
      mockListeners.forEach((listener) => expect(listener.onPlayerJoined).toHaveBeenCalled());
    });
    it.each(ConfigureTest('RLEDE'))('should notify added listeners that the room is destroyed when disconnectAllPlayers is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      room.disconnectAllPlayers();
      mockListeners.forEach((listener) => expect(listener.onRoomDestroyed).toHaveBeenCalled());
    });
    it.each(ConfigureTest('RLEMVN'))('should not notify removed listeners of player movement when updatePlayerLocation is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const removedListeners = removeListeners(room, mockListeners);

      await room.updatePlayerLocation(player, location);
      removedListeners.forEach((listener) => expect(listener.onPlayerMoved).not.toHaveBeenCalled());
    });
    it.each(ConfigureTest('RLEDCN'))('should not notify removed listeners of player disconnections when destroySession is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const removedListeners = removeListeners(room, mockListeners);
      room.destroySession(new PlayerSession(player));
      removedListeners.forEach((listener) => expect(listener.onPlayerDisconnected).not.toHaveBeenCalled());
    });
    it.each(ConfigureTest('RLENPN'))('should not notify removed listeners of new players when addPlayer is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const removedListeners = removeListeners(room, mockListeners);
      await room.addPlayer(new Player('newPlayer'));
      removedListeners.forEach((listener) => expect(listener.onPlayerJoined).not.toHaveBeenCalled());
    });
    it.each(ConfigureTest('RLEDEN'))('should not notify removed listeners that the room is destroyed when disconnectAllPlayers is called [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const removedListeners = removeListeners(room, mockListeners);
      room.disconnectAllPlayers();
      removedListeners.forEach((listener) => expect(listener.onRoomDestroyed).not.toHaveBeenCalled());
    });
  });

  describe('roomSubscriptionHandler', () => {
    /* Set up a mock socket, which you may find to be useful for testing the events that get sent back out to the client
    by the code in CoveyRoomController calling socket.emit.each(ConfigureTest(''))('event', payload) - if you pass the mock socket in place of
    a real socket, you can record the invocations of emit and check them.
     */
    const mockSocket = mock<Socket>();
    /*
    Due to an unfortunate design decision of Avery's, to test the units of CoveyRoomController
    that interact with the socket, we need to: 1. Get a CoveyRoomController from the CoveyRoomsStore, and then 2: call
    the roomSubscriptionHandler method. Ripley's provided some boilerplate code for you to make this a bit easier.
     */
    let playerSession: PlayerSession;
    let sessionToken: string;
    beforeEach(async () => {
      const roomName = `connectPlayerSocket tests ${nanoid()}`;
      // Create a new room to use for each test
      room = CoveyRoomsStore.getInstance().createRoom(roomName, false);
      roomId = room.coveyRoomID;
      player = new Player('masterchief');
      playerSession = await room.addPlayer(player);
      sessionToken = playerSession.sessionToken;
      TestUtils.setSessionTokenAndRoomID(sessionToken, roomId, mockSocket);
      // Reset the log on the mock socket
      mockReset(mockSocket);
    });
    it.each(ConfigureTest('SUBIDDC'))('should reject connections with invalid room IDs by calling disconnect [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      mockSocket.handshake.auth = { token: sessionToken, coveyRoomID: 'Wrong ID' };
      roomSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
    it.each(ConfigureTest('SUBKTDC'))('should reject connections with invalid session tokens by calling disconnect [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      mockSocket.handshake.auth = { token: 'Wrong Session', coveyRoomID: roomId };
      roomSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
    describe('with a valid session token', () => {
      /*
        Ripley says that you might find this helper code useful: it will create a valid session, configure the mock socket
        to identify itself with those tokens, and then calls the roomSubscriptionHandler on the mock socket.

        Your tests should perform operations on testingRoom, and make expectations about what happens to the mock socket.
       */
      let connectedPlayer: Player;
      let secondPlayer: Player;
      let session: PlayerSession;
      let secondSession: PlayerSession;
      beforeEach(async () => {
        connectedPlayer = new Player(`test player ${nanoid()}`);
        session = await room.addPlayer(connectedPlayer);
        sessionToken = session.sessionToken;
        secondPlayer = new Player('newPlayer');
        secondSession = await room.addPlayer(secondPlayer);
        TestUtils.setSessionTokenAndRoomID(room.coveyRoomID, sessionToken, mockSocket);
        roomSubscriptionHandler(mockSocket);
      });
      it.each(ConfigureTest('SUBNP'))('should add a room listener, which should emit "newPlayer" to the socket when a player joins [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);
        const newPlayer = new Player('newPlayer');
        await room.addPlayer(newPlayer);
        expect(mockSocket.emit).toHaveBeenCalledWith('newPlayer', newPlayer);
      });
      it.each(ConfigureTest('SUBMV'))('should add a room listener, which should emit "playerMoved" to the socket when a player moves [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);
        room.updatePlayerLocation(connectedPlayer, location);
        expect(mockSocket.emit).toHaveBeenCalledWith('playerMoved', connectedPlayer);
        room.updatePlayerLocation(secondPlayer, location);
        expect(mockSocket.emit).toHaveBeenCalledWith('playerMoved', secondPlayer);
      });
      it.each(ConfigureTest('SUBDC'))('should add a room listener, which should emit "playerDisconnect" to the socket when a player disconnects [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);
        room.destroySession(secondSession);
        expect(mockSocket.emit).toHaveBeenCalledWith('playerDisconnect', secondPlayer);
        room.destroySession(session);
        expect(mockSocket.emit).toHaveBeenCalledWith('playerDisconnect', connectedPlayer);
      });
      it.each(ConfigureTest('SUBRC'))('should add a room listener, which should emit "roomClosing" to the socket and disconnect it when disconnectAllPlayers is called [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);
        room.disconnectAllPlayers();
        expect(mockSocket.emit).toHaveBeenCalledWith('roomClosing');
        expect(mockSocket.disconnect).toHaveBeenCalled();
      });
      describe('when a socket disconnect event is fired', () => {
        /* Hint: find the on('disconnect') handler that CoveyRoomController registers on the socket, and then
           call that handler directly to simulate a real socket disconnecting.
           */
        // beforeEach(async () => {
        beforeEach(async () => {
          mockSocket.on.mock.calls.forEach((call) => {
            if (call[0] === 'disconnect') {
              call[1]();
            }
          });
        })
        it.each(ConfigureTest('SUBDCRL'))('should remove the room listener for that socket, and stop sending events to it [%s]', async (testConfiguration: string) => {
          StartTest(testConfiguration);
          mockClear(mockSocket);
          mockReset(mockSocket);
          const thirdPlayer = new Player('Third');
          await room.addPlayer(thirdPlayer);
          room.updatePlayerLocation(thirdPlayer, location);
          room.destroySession(secondSession);
          room.disconnectAllPlayers();
          expect(mockSocket.emit).not.toHaveBeenCalledWith('playerMoved', thirdPlayer);
          expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', thirdPlayer);
          expect(mockSocket.emit).not.toHaveBeenCalledWith('playerDisconnect', secondPlayer);
          expect(mockSocket.emit).not.toHaveBeenCalledWith('roomClosing');
        });
        it.each(ConfigureTest('SUBDCSE'))('should destroy the session corresponding to that socket [%s]', async (testConfiguration: string) => {
          StartTest(testConfiguration);
          expect(room.getSessionByToken(sessionToken)).toBeUndefined();
        });
      });
      it.each(ConfigureTest('SUBMVL'))('should forward playerMovement events from the socket to subscribed listeners [%s]', async (testConfiguration: string) => {
        StartTest(testConfiguration);
        mockSocket.on.mock.calls.forEach((call) => {
          if (call[0] === 'playerMovement') {
            call[1](location);
          }
        });
        expect(mockSocket.emit).toHaveBeenCalledWith('playerMoved', connectedPlayer);
      });
    });
  });
});