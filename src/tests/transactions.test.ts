import { describe, test, before } from "node:test";
import assert from "node:assert";
import { connect, Connection } from "..";
import { isSolanaError, KeyPairSigner, lamports, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE, SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED, SolanaError } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { SOL } from "../lib/constants";

describe("Send Transaction From Instructions", () => {
    let sender: KeyPairSigner;
    let recipient: KeyPairSigner;
    let connection: Connection;

    before(async () => {
        connection = connect();
        [sender, recipient] = await connection.createWallets(2, {
            airdropAmount: lamports(1n * SOL),
        });
    });

    test("should send transaction from instructions without client side retries (processed commitment)", async () => {
        const transferInstruction = getTransferSolInstruction({
            source: sender,
            destination: recipient.address,
            amount: lamports(100_000n), // 0.0001 SOL
        });

        const signature = await connection.sendTransactionFromInstructions({
            feePayer: sender,
            instructions: [transferInstruction],
            maximumClientSideRetries: 0,
            commitment: "processed",
        });
        assert.ok(signature, "Transaction should return a signature");
    });
    test("should send transaction from instructions with client side retries (processed commitment)", async () => {
        const transferInstruction = getTransferSolInstruction({
            source: sender,
            destination: recipient.address,
            amount: lamports(100_000n), // 0.0001 SOL
        });

        const signature = await connection.sendTransactionFromInstructions({
            feePayer: sender,
            instructions: [transferInstruction],
            maximumClientSideRetries: 3,
            commitment: "processed",
        });
        assert.ok(signature, "Transaction should return a signature");

    });
    test("should send transaction from instructions without client side retries (default commitment-confirmed)", async () => {
        const transferInstruction = getTransferSolInstruction({
            source: sender,
            destination: recipient.address,
            amount: lamports(100_000n), // 0.0001 SOL
        });

        const signature = await connection.sendTransactionFromInstructions({
            feePayer: sender,
            instructions: [transferInstruction],
            maximumClientSideRetries: 0,
        });
        assert.ok(signature, "Transaction should return a signature");
    });
    test("should send transaction from instructions with client side retries (default commitment-confirmed)", async () => {
        const transferInstruction = getTransferSolInstruction({
            source: sender,
            destination: recipient.address,
            amount: lamports(100_000n), // 0.0001 SOL
        });

        const signature = await connection.sendTransactionFromInstructions({
            feePayer: sender,
            instructions: [transferInstruction],
            maximumClientSideRetries: 3,
        });

        assert.ok(signature, "Transaction should return a signature");

    });
    test("should send transaction from instructions without client side retries (finalized commitment)", async () => {
        const transferInstruction = getTransferSolInstruction({
            source: sender,
            destination: recipient.address,
            amount: lamports(100_000n), // 0.0001 SOL
        });

        const signature = await connection.sendTransactionFromInstructions({
            feePayer: sender,
            instructions: [transferInstruction],
            maximumClientSideRetries: 0,
            commitment: "finalized",
        });
        assert.ok(signature, "Transaction should return a signature");
    });
    test("should send transaction from instructions with client side retries (finalized commitment)", async () => {
        const transferInstruction = getTransferSolInstruction({
            source: sender,
            destination: recipient.address,
            amount: lamports(100_000n), // 0.0001 SOL
        });

        const signature = await connection.sendTransactionFromInstructions({
            feePayer: sender,
            instructions: [transferInstruction],
            maximumClientSideRetries: 3,
            commitment: "finalized",
        });
        assert.ok(signature, "Transaction should return a signature");
    });
    test("should fail if short timeout is used (finalized commitment)", async () => {
        const transferInstruction = getTransferSolInstruction({
            source: sender,
            destination: recipient.address,
            amount: lamports(100_000n), // 0.0001 SOL
        });

        const promise = connection.sendTransactionFromInstructions({
            feePayer: sender,
            instructions: [transferInstruction],
            maximumClientSideRetries: 3,
            commitment: "finalized",
            timeout: 1000,
        });
        await assert.rejects(promise, (error) => {
            // depending on timing, we could get a simulation error or an already processed error
            // we expect one of these errors
            const isSimulationError = isSolanaError(error, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE);
            const isAlreadyProcessedError = isSolanaError(error, SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED);
            return isSimulationError || isAlreadyProcessedError;
        });
    });

});
