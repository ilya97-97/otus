Для запуска потребуется:

1. Установленный Minikube, с включенным ingress (--addons=ingress)
2. Установленный Helm (для установки СУДБ PostgreSQL)
3. Установленный Postman (для проведения тестов готового приложения)

Порядок установки и запуска приложения:

1. Установим СУБД PostgreSQL из локального Helm-чарта

```bash
helm install my-postgresql postgresql-chart/postgresql -f values.yaml
```

2. В /etc/hosts пропишем доменное имя для нашего Ingress, который будет смотреть на ip minikube

> 192.168.49.2  arch.homework

3. Выполним запуск манифестов, для запуска приложения и необходимых сервисов

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/app-deployment.yaml
kubectl apply -f k8s/app-service.yaml
kubectl apply -f k8s/ingress.yaml
```
Состояние подов после запуска может посмотреть следующей командой

```bash
kubectl get pods
```

4. Для проверки доступности Ingress можно выполнить следующую команду

```bash
curl http://arch.homework/
```
Если ответ будет отличным от 404 Error, значит Ingress успешно запущен.

5. При помощи Postman можно протестировать готовое приложение

```bash
postman collection run Users_API.postman_collection.json
```
Вывод Postman:
![postman.png](./postman.png?raw=true)
