using System.Buffers.Binary;
using System.Numerics;
using System.Security.Cryptography;
using PKHeX.Core;

namespace Pksx.Pkhex.Engine;

// .NET on browser WebAssembly has no AES or MD5. PKHeX needs AES for Gen 7 saves and MD5 for BDSP saves.
internal sealed class ManagedAesProvider : IAesCryptographyProvider
{
    public IAesCryptographyProvider.IAes Create(byte[] key, CipherMode mode, PaddingMode padding, byte[]? iv = null)
    {
        if (padding != PaddingMode.None)
            throw new NotSupportedException($"AES padding {padding} is not supported.");
        return new Session(key, iv ?? new byte[BlockSize]);
    }

    private const int BlockSize = 16;
    private static readonly byte[] Sbox = new byte[256];
    private static readonly byte[] InverseSbox = new byte[256];

    static ManagedAesProvider()
    {
        byte p = 1, q = 1;
        do
        {
            p = (byte)(p ^ (p << 1) ^ ((p & 0x80) != 0 ? 0x1B : 0));
            q ^= (byte)(q << 1);
            q ^= (byte)(q << 2);
            q ^= (byte)(q << 4);
            if ((q & 0x80) != 0)
                q ^= 0x09;

            Sbox[p] = (byte)(0x63 ^ q ^ BitOperations.RotateLeft((uint)(q * 0x01010101), 1)
                ^ BitOperations.RotateLeft((uint)(q * 0x01010101), 2)
                ^ BitOperations.RotateLeft((uint)(q * 0x01010101), 3)
                ^ BitOperations.RotateLeft((uint)(q * 0x01010101), 4));
        } while (p != 1);

        Sbox[0] = 0x63;
        for (var i = 0; i < Sbox.Length; i++)
            InverseSbox[Sbox[i]] = (byte)i;
    }

    private static byte Multiply(byte value, int factor)
    {
        int result = 0, current = value;
        for (; factor != 0; factor >>= 1)
        {
            if ((factor & 1) != 0)
                result ^= current;
            current = (current << 1) ^ ((current & 0x80) != 0 ? 0x11B : 0);
        }

        return (byte)result;
    }

    private sealed class Session : IAesCryptographyProvider.IAes
    {
        private readonly byte[] roundKeys;
        private readonly byte[] iv;
        private readonly int rounds;

        public Session(byte[] key, byte[] iv)
        {
            if (key.Length is not (16 or 24 or 32))
                throw new CryptographicException("AES keys must be 16, 24, or 32 bytes.");
            if (iv.Length != BlockSize)
                throw new CryptographicException("AES IVs must be 16 bytes.");

            this.iv = iv;
            rounds = (key.Length / 4) + 6;
            roundKeys = ExpandKey(key, rounds);
        }

        public void Dispose() => CryptographicOperations.ZeroMemory(roundKeys);

        public void EncryptEcb(ReadOnlySpan<byte> plaintext, Span<byte> destination)
        {
            ValidateLengths(plaintext, destination);
            for (var offset = 0; offset < plaintext.Length; offset += BlockSize)
            {
                plaintext.Slice(offset, BlockSize).CopyTo(destination[offset..]);
                EncryptBlock(destination.Slice(offset, BlockSize));
            }
        }

        public void DecryptEcb(ReadOnlySpan<byte> ciphertext, Span<byte> destination)
        {
            ValidateLengths(ciphertext, destination);
            for (var offset = 0; offset < ciphertext.Length; offset += BlockSize)
            {
                ciphertext.Slice(offset, BlockSize).CopyTo(destination[offset..]);
                DecryptBlock(destination.Slice(offset, BlockSize));
            }
        }

        public void EncryptCbc(ReadOnlySpan<byte> plaintext, Span<byte> destination)
        {
            ValidateLengths(plaintext, destination);
            Span<byte> previous = stackalloc byte[BlockSize];
            iv.CopyTo(previous);
            for (var offset = 0; offset < plaintext.Length; offset += BlockSize)
            {
                var block = destination.Slice(offset, BlockSize);
                plaintext.Slice(offset, BlockSize).CopyTo(block);
                Xor(block, previous);
                EncryptBlock(block);
                block.CopyTo(previous);
            }
        }

        public void DecryptCbc(ReadOnlySpan<byte> ciphertext, Span<byte> destination)
        {
            ValidateLengths(ciphertext, destination);
            Span<byte> previous = stackalloc byte[BlockSize];
            Span<byte> current = stackalloc byte[BlockSize];
            iv.CopyTo(previous);
            for (var offset = 0; offset < ciphertext.Length; offset += BlockSize)
            {
                var block = destination.Slice(offset, BlockSize);
                ciphertext.Slice(offset, BlockSize).CopyTo(current);
                current.CopyTo(block);
                DecryptBlock(block);
                Xor(block, previous);
                current.CopyTo(previous);
            }
        }

        private static void ValidateLengths(ReadOnlySpan<byte> input, Span<byte> destination)
        {
            if (input.Length % BlockSize != 0)
                throw new CryptographicException("AES input must be a whole number of blocks.");
            if (destination.Length < input.Length)
                throw new ArgumentException("AES destination is too small.", nameof(destination));
        }

        private static byte[] ExpandKey(byte[] key, int rounds)
        {
            var expanded = new byte[BlockSize * (rounds + 1)];
            key.CopyTo(expanded, 0);
            byte roundConstant = 1;
            for (var i = key.Length; i < expanded.Length; i += 4)
            {
                Span<byte> word = expanded.AsSpan(i - 4, 4).ToArray();
                if (i % key.Length == 0)
                {
                    var first = word[0];
                    word[0] = (byte)(Sbox[word[1]] ^ roundConstant);
                    word[1] = Sbox[word[2]];
                    word[2] = Sbox[word[3]];
                    word[3] = Sbox[first];
                    roundConstant = Multiply(roundConstant, 2);
                }
                else if (key.Length == 32 && i % key.Length == BlockSize)
                {
                    for (var j = 0; j < word.Length; j++)
                        word[j] = Sbox[word[j]];
                }

                for (var j = 0; j < word.Length; j++)
                    expanded[i + j] = (byte)(expanded[i + j - key.Length] ^ word[j]);
            }

            return expanded;
        }

        private void EncryptBlock(Span<byte> state)
        {
            Xor(state, roundKeys.AsSpan(0, BlockSize));
            for (var round = 1; round <= rounds; round++)
            {
                Substitute(state, Sbox);
                ShiftRows(state, 1);
                if (round != rounds)
                    MixColumns(state, 2, 3, 1, 1);
                Xor(state, roundKeys.AsSpan(round * BlockSize, BlockSize));
            }
        }

        private void DecryptBlock(Span<byte> state)
        {
            for (var round = rounds; round >= 1; round--)
            {
                Xor(state, roundKeys.AsSpan(round * BlockSize, BlockSize));
                if (round != rounds)
                    MixColumns(state, 14, 11, 13, 9);
                ShiftRows(state, 3);
                Substitute(state, InverseSbox);
            }

            Xor(state, roundKeys.AsSpan(0, BlockSize));
        }

        private static void Substitute(Span<byte> state, byte[] box)
        {
            for (var i = 0; i < state.Length; i++)
                state[i] = box[state[i]];
        }

        private static void ShiftRows(Span<byte> state, int direction)
        {
            Span<byte> original = stackalloc byte[BlockSize];
            state.CopyTo(original);
            for (var column = 0; column < 4; column++)
            {
                for (var row = 0; row < 4; row++)
                    state[(column * 4) + row] = original[(((column + (row * direction)) % 4) * 4) + row];
            }
        }

        private static void MixColumns(Span<byte> state, int a, int b, int c, int d)
        {
            for (var offset = 0; offset < BlockSize; offset += 4)
            {
                byte s0 = state[offset], s1 = state[offset + 1], s2 = state[offset + 2], s3 = state[offset + 3];
                state[offset] = (byte)(Multiply(s0, a) ^ Multiply(s1, b) ^ Multiply(s2, c) ^ Multiply(s3, d));
                state[offset + 1] = (byte)(Multiply(s0, d) ^ Multiply(s1, a) ^ Multiply(s2, b) ^ Multiply(s3, c));
                state[offset + 2] = (byte)(Multiply(s0, c) ^ Multiply(s1, d) ^ Multiply(s2, a) ^ Multiply(s3, b));
                state[offset + 3] = (byte)(Multiply(s0, b) ^ Multiply(s1, c) ^ Multiply(s2, d) ^ Multiply(s3, a));
            }
        }

        private static void Xor(Span<byte> target, ReadOnlySpan<byte> other)
        {
            for (var i = 0; i < target.Length; i++)
                target[i] ^= other[i];
        }
    }
}

internal sealed class ManagedMd5Provider : IMd5Provider
{
    private const int BlockSize = 64;
    private static readonly uint[] Constants = CreateConstants();
    private static readonly byte[] Shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

    public void HashData(ReadOnlySpan<byte> source, Span<byte> destination)
    {
        Span<uint> state = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
        var whole = source.Length - (source.Length % BlockSize);
        for (var offset = 0; offset < whole; offset += BlockSize)
            Transform(state, source.Slice(offset, BlockSize));

        var remainder = source[whole..];
        Span<byte> tail = stackalloc byte[BlockSize * 2];
        tail.Clear();
        remainder.CopyTo(tail);
        tail[remainder.Length] = 0x80;
        var tailLength = remainder.Length < BlockSize - 8 ? BlockSize : BlockSize * 2;
        BinaryPrimitives.WriteUInt64LittleEndian(tail[(tailLength - 8)..], (ulong)source.Length * 8);
        for (var offset = 0; offset < tailLength; offset += BlockSize)
            Transform(state, tail.Slice(offset, BlockSize));

        for (var i = 0; i < state.Length; i++)
            BinaryPrimitives.WriteUInt32LittleEndian(destination[(i * 4)..], state[i]);
    }

    private static uint[] CreateConstants()
    {
        var constants = new uint[BlockSize];
        for (var i = 0; i < constants.Length; i++)
            constants[i] = (uint)(Math.Abs(Math.Sin(i + 1)) * 4294967296.0);
        return constants;
    }

    private static void Transform(Span<uint> state, ReadOnlySpan<byte> block)
    {
        uint a = state[0], b = state[1], c = state[2], d = state[3];
        for (var i = 0; i < BlockSize; i++)
        {
            var (mix, word) = (i / 16) switch
            {
                0 => ((b & c) | (~b & d), i),
                1 => ((d & b) | (~d & c), ((5 * i) + 1) % 16),
                2 => (b ^ c ^ d, ((3 * i) + 5) % 16),
                _ => (c ^ (b | ~d), (7 * i) % 16)
            };
            var rotated = a + mix + Constants[i] + BinaryPrimitives.ReadUInt32LittleEndian(block[(word * 4)..]);
            a = d;
            d = c;
            c = b;
            b += BitOperations.RotateLeft(rotated, Shifts[((i / 16) * 4) + (i % 4)]);
        }

        state[0] += a;
        state[1] += b;
        state[2] += c;
        state[3] += d;
    }
}
