def fibonacci(n):
    if n <= 0:
        return []
    if n == 1:
        return [0]
    if n == 2:
        return [0, 1]
    
    result = [0, 1]
    for i in range(2, n):
        result.append(result[i-1] + result[i-2])
    return result


if __name__ == "__main__":
    fib_numbers = fibonacci(10)
    print("First 10 Fibonacci numbers:")
    for i, num in enumerate(fib_numbers):
        print(f"{i+1}: {num}")
