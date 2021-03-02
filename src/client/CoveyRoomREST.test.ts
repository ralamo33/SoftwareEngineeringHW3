import Express from 'express';
import CORS from 'cors';
import http from 'http';
import { AddressInfo } from 'net';

import addRoomRoutes from '../router/room';
import RoomServiceClient from './RoomServiceClient';
import { ConfigureTest, StartTest } from '../FaultManager';

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
      // Example demonstrating how to call the API client and wait for its result.
      // Feel free to delete this when you start to implement these tests.
      await apiClient.createRoom({ friendlyName: 'testFriendlyName', isPubliclyListed: true });
    });
    it.each(ConfigureTest('CR2'))('Prohibits a blank friendlyName [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
  });

  describe('CoveyRoomListAPI', () => {
    it.each(ConfigureTest('LPub'))('Lists public rooms, but not private rooms [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
    it.each(ConfigureTest('LMF'))('Allows for multiple rooms with the same friendlyName [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
  });

  describe('CoveyRoomDeleteAPI', () => {
    it.each(ConfigureTest('DRP'))('Throws an error if the password is invalid [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
    it.each(ConfigureTest('DRID'))('Throws an error if the roomID is invalid [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
    it.each(ConfigureTest('DRV'))('Deletes a room if given a valid password and room, no longer allowing it to be joined or listed [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
  });

  describe('CoveyRoomUpdateAPI', () => {
    it.each(ConfigureTest('CPU'))('Checks the password before updating any values [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
    it.each(ConfigureTest('UFV'))('Updates the friendlyName and visbility as requested [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
    it.each(ConfigureTest('UFVU'))('Does not update the visibility if visibility is undefined [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
  });

  describe('CoveyMemberAPI', () => {
    it.each(ConfigureTest('MNSR'))('Throws an error if the room does not exist [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
    it.each(ConfigureTest('MJPP'))('Admits a user to a valid public or private room [%s]', async (testConfiguration: string) => {
      StartTest(testConfiguration);

    });
  });
});
