import Express from 'express';
import CORS from 'cors';
import http from 'http';
import { AddressInfo } from 'net';

import addRoomRoutes from '../router/room';
import RoomServiceClient from './RoomServiceClient';
import { ConfigureTest, StartTest } from '../FaultManager';
import { SyncStreamContext } from 'twilio/lib/rest/sync/v1/service/syncStream';
import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks';

describe('RoomServiceApiREST', () => {
  /* A testing server that will be deployed before testing and reused throughout all of the tests */
  let server: http.Server;
  /* A testing client that will be automatically configured with a serviceURL to point to the testing server */
  let apiClient: RoomServiceClient;

  beforeAll(async () => {
    // Deploy a testing server
    const app = Express();
    app.use(CORS());
    server = http.createServer(app);
    addRoomRoutes(server, app);
    server.listen();
    const address = server.address() as AddressInfo;

    // Create the testing client
    apiClient = new RoomServiceClient(`http://127.0.0.1:${address.port}`);
  });

  afterAll(async () => {
    // After all tests are done, shut down the server to avoid any resource leaks
    server.close();
  });

  describe('CoveyRoomCreateAPI', () => {
    it.each(ConfigureTest('CR'))('Allows for multiple rooms with the same friendlyName [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      await apiClient.createRoom({ friendlyName: 'The Alamo', isPubliclyListed: true });
      await apiClient.createRoom({ friendlyName: 'The Alamo', isPubliclyListed: true });
      await apiClient.createRoom({ friendlyName: 'Room', isPubliclyListed: false });
      await apiClient.createRoom({ friendlyName: 'Room', isPubliclyListed: true });
    });
    it.each(ConfigureTest('CR2'))('Prohibits a blank friendlyName [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      await expect(apiClient.createRoom({ friendlyName: '', isPubliclyListed: true })).rejects.toThrow();
      await expect(apiClient.createRoom({ friendlyName: '', isPubliclyListed: false })).rejects.toThrow();
    });
  });

  describe('CoveyRoomListAPI', () => {
    it.each(ConfigureTest('LPub'))('Lists public rooms, but not private rooms [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      await apiClient.createRoom({ friendlyName: 'Public1', isPubliclyListed: true });
      await apiClient.createRoom({ friendlyName: 'Private1', isPubliclyListed: false });
      await apiClient.createRoom({ friendlyName: 'Public2', isPubliclyListed: true });
      await apiClient.createRoom({ friendlyName: 'Private2', isPubliclyListed: false });
      const result = await apiClient.listRooms();
      const friendlyNames = result['rooms'].map((room) => {
        return room.friendlyName;
      })
      expect(friendlyNames).toContain('Public1');
      expect(friendlyNames).toContain('Public2');
      expect(friendlyNames).not.toContain('Private1');
      expect(friendlyNames).not.toContain('Private2');
    });
    it.each(ConfigureTest('LMF'))('Allows for multiple rooms with the same friendlyName [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      await apiClient.createRoom({ friendlyName: 'The Alamo', isPubliclyListed: true });
      await apiClient.createRoom({ friendlyName: 'The Alamo', isPubliclyListed: true });
      await apiClient.createRoom({ friendlyName: 'Room', isPubliclyListed: false });
      await apiClient.createRoom({ friendlyName: 'Room', isPubliclyListed: true });
      await apiClient.createRoom({ friendlyName: 'Private', isPubliclyListed: false });
      await apiClient.createRoom({ friendlyName: 'Private', isPubliclyListed: false });
    });
  });

  describe('CoveyRoomDeleteAPI', () => {
   it.each(ConfigureTest('DRP'))('Throws an error if the password is invalid [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const roomInfoPublic = await apiClient.createRoom({ friendlyName: 'Delete Public', isPubliclyListed: true });
      const roomInfoPrivate = await apiClient.createRoom({ friendlyName: 'Delete Private', isPubliclyListed: false });
      const idPublic = roomInfoPublic.coveyRoomID;
      const idPrivate = roomInfoPrivate.coveyRoomID;
      const passwordPublic = roomInfoPublic.coveyRoomPassword;
      const passwordPrivate = roomInfoPrivate.coveyRoomPassword;
      const wrongPassword = passwordPublic + passwordPrivate;
      // await expect(apiClient.deleteRoom({ coveyRoomID: idPublic, coveyRoomPassword: wrongPassword})).rejects.toThrow();
      await expect(apiClient.deleteRoom({ coveyRoomID: idPublic, coveyRoomPassword: passwordPrivate})).rejects.toThrow();
      // await expect(apiClient.deleteRoom({ coveyRoomID: idPrivate, coveyRoomPassword: wrongPassword})).rejects.toThrow();
      await expect(apiClient.deleteRoom({ coveyRoomID: idPrivate, coveyRoomPassword: passwordPublic})).rejects.toThrow();
    });
    it.each(ConfigureTest('DRID'))('Throws an error if the roomID is invalid [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const roomInfoPublic = await apiClient.createRoom({ friendlyName: 'Delete Public2', isPubliclyListed: true });
      const roomInfoPrivate = await apiClient.createRoom({ friendlyName: 'Delete Private2', isPubliclyListed: false });
      const idPublic = roomInfoPublic.coveyRoomID;
      const idPrivate = roomInfoPrivate.coveyRoomID;
      const passwordPublic = roomInfoPublic.coveyRoomPassword;
      const passwordPrivate = roomInfoPrivate.coveyRoomPassword;
      await expect(apiClient.deleteRoom({ coveyRoomID: idPublic + 'e', coveyRoomPassword: passwordPublic})).rejects.toThrow();
      await expect(apiClient.deleteRoom({ coveyRoomID: 'e' + idPublic, coveyRoomPassword: passwordPublic})).rejects.toThrow();
      await expect(apiClient.deleteRoom({ coveyRoomID: idPrivate + 'e', coveyRoomPassword: passwordPrivate})).rejects.toThrow();
      await expect(apiClient.deleteRoom({ coveyRoomID: 'e' + idPrivate, coveyRoomPassword: passwordPrivate})).rejects.toThrow();
    });
    it.each(ConfigureTest('DRV'))('Deletes a room if given a valid password and room, no longer allowing it to be joined or listed [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const roomInfoPublic = await apiClient.createRoom({ friendlyName: 'Delete Public3', isPubliclyListed: true });
      const roomInfoPrivate = await apiClient.createRoom({ friendlyName: 'Delete Private3', isPubliclyListed: false });
      const idPublic = roomInfoPublic.coveyRoomID;
      const idPrivate = roomInfoPrivate.coveyRoomID;
      const passwordPublic = roomInfoPublic.coveyRoomPassword;
      const passwordPrivate = roomInfoPrivate.coveyRoomPassword;
      await apiClient.deleteRoom({ coveyRoomID: idPublic, coveyRoomPassword: passwordPublic});
      await apiClient.deleteRoom({ coveyRoomID: idPrivate, coveyRoomPassword: passwordPrivate});
      await expect(apiClient.joinRoom({ userName: 'Ryan', coveyRoomID: idPublic})).rejects.toThrow();
      await expect(apiClient.joinRoom({ userName: 'Master Chief', coveyRoomID: idPrivate})).rejects.toThrow();
      const result = await apiClient.listRooms();
      const friendlyNames = result['rooms'].map((room) => {
        return room.friendlyName;
      });
      expect(friendlyNames).not.toContain('Delete Public3');
      expect(friendlyNames).not.toContain('Delete Private3');
    });
  });

  describe('CoveyRoomUpdateAPI', () => {
    it.each(ConfigureTest('CPU'))('Checks the password before updating any values [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const roomInfoPublic = await apiClient.createRoom({ friendlyName: 'Update Public', isPubliclyListed: true });
      const roomInfoPrivate = await apiClient.createRoom({ friendlyName: 'Update Private', isPubliclyListed: false });
      const idPublic = roomInfoPublic.coveyRoomID;
      const idPrivate = roomInfoPrivate.coveyRoomID;
      const passwordPublic = roomInfoPublic.coveyRoomPassword;
      const passwordPrivate = roomInfoPrivate.coveyRoomPassword;
      await expect(apiClient.updateRoom( { coveyRoomID: idPublic, coveyRoomPassword: passwordPrivate, 
        friendlyName: 'Changed to Private', isPubliclyListed: false})).rejects.toThrow();
      await expect(apiClient.updateRoom( { coveyRoomID: idPrivate, coveyRoomPassword: passwordPublic,
        friendlyName: 'Changed to Public', isPubliclyListed: true} )).rejects.toThrow();
      const rooms = await apiClient.listRooms();
      const roomNames = rooms['rooms'].map((room) => {
        return room.friendlyName;
      });
      expect(roomNames).toContain('Update Public');
      expect(roomNames).not.toContain('Update Private');
      expect(roomNames).not.toContain('Changed to Private');
      expect(roomNames).not.toContain('Changed to Public');
    });
    it.each(ConfigureTest('UFV'))('Updates the friendlyName and visbility as requested [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const roomInfoPublic = await apiClient.createRoom({ friendlyName: 'Update Public2', isPubliclyListed: true });
      const roomInfoPrivate = await apiClient.createRoom({ friendlyName: 'Update Private2', isPubliclyListed: false });
      const idPublic = roomInfoPublic.coveyRoomID;
      const idPrivate = roomInfoPrivate.coveyRoomID;
      const passwordPublic = roomInfoPublic.coveyRoomPassword;
      const passwordPrivate = roomInfoPrivate.coveyRoomPassword;
      await apiClient.updateRoom( { coveyRoomID: idPublic, coveyRoomPassword: passwordPublic, 
        friendlyName: 'Changed to Private2', isPubliclyListed: false});
      await apiClient.updateRoom( { coveyRoomID: idPrivate, coveyRoomPassword: passwordPrivate,
        friendlyName: 'Changed to Public2', isPubliclyListed: true});
      const rooms = await apiClient.listRooms();
      const roomNames = rooms['rooms'].map((room) => {
        return room.friendlyName;
      });

      expect(roomNames).toContain('Changed to Public2');
      expect(roomNames).not.toContain('Update Public2');
      expect(roomNames).not.toContain('Update Private2');
      expect(roomNames).not.toContain('Changed to Private2');
 
    });
    it.each(ConfigureTest('UFVU'))('Does not update the visibility if visibility is undefined [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const roomInfoPublic = await apiClient.createRoom({ friendlyName: 'Update Public3', isPubliclyListed: true });
      const roomInfoPrivate = await apiClient.createRoom({ friendlyName: 'Update Private3', isPubliclyListed: false });
      const idPublic = roomInfoPublic.coveyRoomID;
      const idPrivate = roomInfoPrivate.coveyRoomID;
      const passwordPublic = roomInfoPublic.coveyRoomPassword;
      const passwordPrivate = roomInfoPrivate.coveyRoomPassword;
      apiClient.updateRoom( { coveyRoomID: idPublic, coveyRoomPassword: passwordPublic, 
        friendlyName: 'ChangedName1'});
      await apiClient.updateRoom( { coveyRoomID: idPrivate, coveyRoomPassword: passwordPrivate,
        friendlyName: 'ChangedName2'});
      const rooms = await apiClient.listRooms();
      const roomNames = rooms['rooms'].map((room) => {
        return room.friendlyName;
      });

      expect(roomNames).toContain('ChangedName1');
      expect(roomNames).not.toContain('Update Public3');
      expect(roomNames).not.toContain('Update Private3');
      expect(roomNames).not.toContain('ChangedName2');
    });
  });

  describe('CoveyMemberAPI', () => {
    it.each(ConfigureTest('MNSR'))('Throws an error if the room does not exist [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      expect(apiClient.joinRoom( { userName: 'Masterchief', coveyRoomID: '12345689891232323232322323232' } )).rejects.toThrow();
    });
    it.each(ConfigureTest('MJPP'))('Admits a user to a valid public or private room [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);
      const roomInfoPublic = await apiClient.createRoom({ friendlyName: 'Update Public3', isPubliclyListed: true });
      const roomInfoPrivate = await apiClient.createRoom({ friendlyName: 'Update Private3', isPubliclyListed: false });
      const idPublic = roomInfoPublic.coveyRoomID;
      const idPrivate = roomInfoPrivate.coveyRoomID;
      apiClient.joinRoom({ userName: 'Masterchief', coveyRoomID: idPublic });
      apiClient.joinRoom({ userName: 'Masterchief', coveyRoomID: idPrivate });
    });
  });
});
